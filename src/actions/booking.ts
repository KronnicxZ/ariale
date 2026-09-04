"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentClient, getCurrentSpecialist, getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createAppointment, findOrCreateClient } from "@/actions/appointments";
import { repartirServicios } from "@/lib/slots";
import { fmtDayLong, fmtDayShort, fmtTime } from "@/lib/date";
import { avisarNuevaCita } from "@/lib/push";
import { toMessage } from "@/actions/shared";

export type BookingInput = {
  serviceIds: string[];
  specialistId: string | null;
  day: string;
  time: string;
  note: string;
};

export type BookingOutcome =
  | {
      ok: true;
      appointmentId: string;
      status: string;
      whenLabel: string;
      timeLabel: string;
      servicesLabel: string;
      totalCents: number;
      specialistName: string;
    }
  | { ok: false; error: string };

/** Cuando la clienta no eligió especialista, tomamos la primera libre. */
async function resolveSpecialist(input: BookingInput): Promise<string> {
  if (input.specialistId) return input.specialistId;

  const settings = await getSettings();
  const services = await prisma.service.findMany({
    where: { id: { in: input.serviceIds } },
    select: { durationMin: true },
  });
  const durationMin = services.reduce((sum, s) => sum + s.durationMin, 0) || 30;

  const { tzDateTimeToUtc } = await import("@/lib/date");
  const startAt = tzDateTimeToUtc(input.day, input.time, settings.timezone);
  const endAt = new Date(startAt.getTime() + durationMin * 60_000);

  const candidates = await prisma.specialist.findMany({
    where: { active: true },
    include: { skills: { select: { serviceId: true } } },
    orderBy: { name: "asc" },
  });

  for (const candidate of candidates) {
    const skills = candidate.skills.map((s) => s.serviceId);
    const canDoAll = skills.length === 0 || input.serviceIds.every((id) => skills.includes(id));
    if (!canDoAll) continue;

    const busy = await prisma.appointment.findFirst({
      where: {
        specialistId: candidate.id,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });
    if (!busy) return candidate.id;
  }

  throw new Error("Ese horario se acaba de ocupar. Elige otro, por favor.");
}

async function book(
  input: BookingInput,
  clientId: string,
  source: "ADMIN" | "SPECIALIST" | "CLIENT",
  forceSpecialistId?: string,
): Promise<BookingOutcome> {
  try {
    const settings = await getSettings();

    // Servicios de dos áreas y nadie fija: una cita por especialista, a la
    // misma hora — el mismo criterio que usa la app del teléfono.
    const reparto =
      forceSpecialistId || input.specialistId ? null : await repartirServicios(input.serviceIds);

    if (reparto?.huerfanos.length) {
      throw new Error("Nadie del equipo hace uno de los servicios elegidos.");
    }
    if (reparto && reparto.grupos.length >= 2) {
      const citas = [];
      for (const grupo of reparto.grupos) {
        citas.push(
          await createAppointment({
            clientId,
            specialistId: grupo.specialistId,
            serviceIds: grupo.serviceIds,
            day: input.day,
            time: input.time,
            note: input.note,
            source,
            // Una reserva, un aviso: se manda abajo con los servicios de
            // las dos citas juntos.
            silenciar: true,
          }),
        );
      }
      const [primera] = citas;

      if (source === "CLIENT") {
        avisarNuevaCita({
          appointmentId: primera.id,
          clientName: primera.client.name,
          services: citas.flatMap((c) => c.services.map((s) => s.service.name)).join(" + "),
          day: fmtDayShort(primera.startAt, settings.timezone),
          time: fmtTime(primera.startAt, settings.timezone),
        }).catch((error) => {
          console.error("[push] no se pudo avisar la nueva cita", error);
        });
      }

      return {
        ok: true,
        appointmentId: primera.id,
        status: primera.status,
        whenLabel: fmtDayLong(primera.startAt, settings.timezone),
        timeLabel: fmtTime(primera.startAt, settings.timezone),
        servicesLabel: citas
          .flatMap((c) => c.services.map((s) => s.service.name))
          .join(" + "),
        totalCents: citas.reduce(
          (sum, c) => sum + c.services.reduce((s, x) => s + x.priceCents, 0),
          0,
        ),
        specialistName: citas.map((c) => c.specialist.name).join(" y "),
      };
    }

    const specialistId = forceSpecialistId ?? (await resolveSpecialist(input));

    const appointment = await createAppointment({
      clientId,
      specialistId,
      serviceIds: input.serviceIds,
      day: input.day,
      time: input.time,
      note: input.note,
      source,
    });

    return {
      ok: true,
      appointmentId: appointment.id,
      status: appointment.status,
      whenLabel: fmtDayLong(appointment.startAt, settings.timezone),
      timeLabel: fmtTime(appointment.startAt, settings.timezone),
      servicesLabel: appointment.services.map((s) => s.service.name).join(" + "),
      totalCents: appointment.services.reduce((sum, s) => sum + s.priceCents, 0),
      specialistName: appointment.specialist.name,
    };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** Desde el panel: la dueña agenda a nombre de cualquier clienta. */
export async function adminBookAction(
  input: BookingInput & { client: { kind: "existing"; id: string } | { kind: "new"; name: string; phone: string } },
): Promise<BookingOutcome> {
  if (!(await getCurrentUser())) return { ok: false, error: "Tu sesión caducó." };

  try {
    const client =
      input.client.kind === "existing"
        ? { id: input.client.id }
        : await findOrCreateClient(input.client.name, input.client.phone);

    const result = await book(input, client.id, "ADMIN");
    if (result.ok) {
      revalidatePath("/panel");
      revalidatePath("/panel/agenda");
      revalidatePath("/panel/clientes");
    }
    return result;
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** Desde la agenda de la especialista: siempre queda confirmada y a su nombre. */
export async function specialistBookAction(
  input: BookingInput & { client: { kind: "existing"; id: string } | { kind: "new"; name: string; phone: string } },
): Promise<BookingOutcome> {
  const specialist = await getCurrentSpecialist();
  if (!specialist) return { ok: false, error: "Tu sesión caducó. Vuelve a poner tu clave." };

  try {
    const client =
      input.client.kind === "existing"
        ? { id: input.client.id }
        : await findOrCreateClient(input.client.name, input.client.phone);

    const result = await book(input, client.id, "SPECIALIST", specialist.id);
    if (result.ok) {
      await prisma.appointment.update({
        where: { id: result.appointmentId },
        data: { status: "CONFIRMED" },
      });
      revalidatePath(`/agenda/${specialist.slug}`);
      revalidatePath("/panel/agenda");
    }
    return result.ok ? { ...result, status: "CONFIRMED" } : result;
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** Desde el enlace público: la clienta reserva para sí misma. */
export async function clientBookAction(input: BookingInput): Promise<BookingOutcome> {
  const client = await getCurrentClient();
  if (!client) return { ok: false, error: "Tu sesión caducó. Escribe tu teléfono de nuevo." };

  const result = await book(input, client.id, "CLIENT");
  if (result.ok) {
    revalidatePath("/reservar");
    revalidatePath("/panel/agenda");
  }
  return result;
}

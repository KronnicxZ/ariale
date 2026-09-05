"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  getAvailability,
  getAvailabilityRepartida,
  getDiasConHueco,
  repartirServicios,
} from "@/lib/slots";
import { normalizePhone } from "@/lib/utils";
import { fmtDayShort, fmtTime, tzDateTimeToUtc } from "@/lib/date";
import { avisarNuevaCita } from "@/lib/push";
import {
  fail,
  ok,
  readBool,
  readList,
  readOptional,
  readString,
  requireUser,
  toMessage,
  type ActionState,
} from "@/actions/shared";
import type { AppointmentStatus, BookingSource } from "@/generated/prisma/client";

/**
 * Alta de cita. Se usa desde el panel, desde la agenda de la especialista y
 * desde la zona pública de la clienta, con la misma validación de solape.
 */
export async function createAppointment(input: {
  clientId: string;
  specialistId: string;
  serviceIds: string[];
  day: string;
  time: string;
  note?: string | null;
  /** El diseño que quiere la clienta: foto subida o enlace suyo. */
  referenceUrl?: string | null;
  source: BookingSource;
  status?: AppointmentStatus;
  /**
   * Para las reservas que se parten en dos citas (una por área, a la misma
   * hora): cada cita calla y quien llama manda un solo aviso con todo. Si
   * no, al teléfono le llegan dos notificaciones de la misma clienta.
   */
  silenciar?: boolean;
}) {
  const settings = await getSettings();

  const services = await prisma.service.findMany({
    where: { id: { in: input.serviceIds }, active: true },
  });
  if (services.length === 0) throw new Error("Elige al menos un servicio.");

  const durationMin = services.reduce((sum, s) => sum + s.durationMin, 0);
  const startAt = tzDateTimeToUtc(input.day, input.time, settings.timezone);
  const endAt = new Date(startAt.getTime() + durationMin * 60_000);

  // Revalidamos el hueco contra la base al momento de guardar: entre que la
  // clienta vio los horarios y pulsó confirmar, alguien pudo tomar el suyo.
  const clash = await prisma.appointment.findFirst({
    where: {
      specialistId: input.specialistId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });
  if (clash) throw new Error("Ese horario se acaba de ocupar. Elige otro, por favor.");

  const appointment = await prisma.appointment.create({
    data: {
      clientId: input.clientId,
      specialistId: input.specialistId,
      startAt,
      endAt,
      note: input.note || null,
      referenceUrl: input.referenceUrl || null,
      source: input.source,
      status:
        input.status ??
        (input.source === "CLIENT" && !settings.autoConfirm ? "PENDING" : "CONFIRMED"),
      services: {
        create: services.map((s) => ({
          serviceId: s.id,
          priceCents: s.priceCents,
          durationMin: s.durationMin,
        })),
      },
    },
    include: {
      client: true,
      specialist: true,
      services: { include: { service: true } },
    },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/agenda");
  revalidatePath("/panel/modo-agenda");

  // Solo cuando agenda la clienta desde la web: si la crea el equipo desde
  // el panel o la app, ya lo sabe de sobra.
  if (input.source === "CLIENT" && !input.silenciar) {
    avisarNuevaCita({
      appointmentId: appointment.id,
      clientName: appointment.client.name,
      services: appointment.services.map((s) => s.service.name).join(" + "),
      day: fmtDayShort(appointment.startAt, settings.timezone),
      time: fmtTime(appointment.startAt, settings.timezone),
    }).catch((error) => {
      // El aviso es un extra: si Firebase falla, la cita ya quedó guardada.
      console.error("[push] no se pudo avisar la nueva cita", error);
    });
  }

  return appointment;
}

export async function createAppointmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();

    const clientId = readString(formData, "clientId");
    const specialistId = readString(formData, "specialistId");
    const serviceIds = readList(formData, "serviceIds");
    const day = readString(formData, "day");
    const time = readString(formData, "time");

    if (!clientId) return fail("Elige una clienta.");
    if (!specialistId) return fail("Elige una especialista.");
    if (serviceIds.length === 0) return fail("Elige al menos un servicio.");
    if (!day || !time) return fail("Elige el día y la hora.");

    const appointment = await createAppointment({
      clientId,
      specialistId,
      serviceIds,
      day,
      time,
      note: readOptional(formData, "note"),
      source: "ADMIN",
      status: readBool(formData, "confirmed") ? "CONFIRMED" : "PENDING",
    });

    return ok("Cita agendada.", appointment.id);
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function updateAppointmentStatusAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const status = readString(formData, "status") as AppointmentStatus;
  const cancelReason = readOptional(formData, "cancelReason");

  await prisma.appointment.update({
    where: { id },
    data: { status, ...(status === "CANCELLED" ? { cancelReason } : {}) },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/agenda");
  revalidatePath(`/panel/agenda/${id}`);
  revalidatePath("/panel/modo-agenda");
}

export async function rescheduleAppointmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();
    const settings = await getSettings();

    const id = readString(formData, "id");
    const day = readString(formData, "day");
    const time = readString(formData, "time");
    if (!id || !day || !time) return fail("Falta el día o la hora.");

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { services: true },
    });
    if (!appointment) return fail("La cita ya no existe.");

    const durationMin = appointment.services.reduce((sum, s) => sum + s.durationMin, 0);
    const startAt = tzDateTimeToUtc(day, time, settings.timezone);
    const endAt = new Date(startAt.getTime() + durationMin * 60_000);

    const clash = await prisma.appointment.findFirst({
      where: {
        id: { not: id },
        specialistId: appointment.specialistId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });
    if (clash) return fail("Ese horario ya está ocupado.");

    await prisma.appointment.update({ where: { id }, data: { startAt, endAt } });

    revalidatePath("/panel/agenda");
    revalidatePath(`/panel/agenda/${id}`);
    revalidatePath("/panel/modo-agenda");
    return ok("Cita reprogramada.");
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function deleteAppointmentAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  await prisma.appointment.delete({ where: { id } });
  revalidatePath("/panel/agenda");
  revalidatePath("/panel/modo-agenda");
}

export async function markReminderSentAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const appointment = await prisma.appointment.update({
    where: { id },
    data: { reminderSentAt: new Date() },
    select: { clientId: true },
  });
  await prisma.reminderLog.create({
    data: { kind: "APPOINTMENT", clientId: appointment.clientId, appointmentId: id },
  });
  revalidatePath("/panel/recordatorios");
}

/** Huecos libres de un día, para los selectores de hora. */
export async function fetchSlotsAction(input: {
  day: string;
  serviceIds: string[];
  specialistId?: string | null;
  excludeAppointmentId?: string;
}) {
  const services = await prisma.service.findMany({
    where: { id: { in: input.serviceIds } },
    select: { durationMin: true },
  });
  const durationMin = services.reduce((sum, s) => sum + s.durationMin, 0) || 30;

  // Sin especialista fija y con servicios de dos áreas, la cita se reparte:
  // valen las horas en las que las dos están libres a la vez.
  const reparto = input.specialistId ? null : await repartirServicios(input.serviceIds);

  const availability =
    reparto && reparto.grupos.length >= 2 && reparto.huerfanos.length === 0
      ? await getAvailabilityRepartida({
          day: input.day,
          grupos: reparto.grupos,
          excludeAppointmentId: input.excludeAppointmentId,
        })
      : await getAvailability({
          day: input.day,
          durationMin,
          specialistId: input.specialistId ?? null,
          serviceIds: input.serviceIds,
          excludeAppointmentId: input.excludeAppointmentId,
        });

  return {
    ...availability,
    durationMin,
    slots: availability.slots.map((s) => ({ time: s.time, period: s.period })),
  };
}

/**
 * Qué días del tramo tienen al menos un hueco, para que el calendario apague
 * los que no. Sin esto, la clienta podía elegir un día cualquiera y toparse
 * con la lista de horas vacía —que fue justo lo que pasó.
 */
export async function fetchDiasAction(input: {
  desde: string;
  hasta: string;
  serviceIds: string[];
  specialistId?: string | null;
}) {
  if (input.serviceIds.length === 0) return { dias: [] as string[] };
  const dias = await getDiasConHueco({
    desde: input.desde,
    hasta: input.hasta,
    serviceIds: input.serviceIds,
    specialistId: input.specialistId ?? null,
  });
  return { dias };
}

/** Busca o crea la clienta por teléfono. El teléfono es la identidad. */
export async function findOrCreateClient(name: string, phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 10) throw new Error("El teléfono no parece válido.");

  const existing = await prisma.client.findUnique({ where: { phone: normalized } });
  if (existing) {
    if (!existing.active) {
      return prisma.client.update({ where: { id: existing.id }, data: { active: true } });
    }
    return existing;
  }

  if (!name.trim()) throw new Error("Escribe el nombre de la clienta.");
  return prisma.client.create({ data: { name: name.trim(), phone: normalized } });
}

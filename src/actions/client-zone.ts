"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentClient, setClientSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getAvailability } from "@/lib/slots";
import { tzDateTimeToUtc } from "@/lib/date";
import { normalizePhone } from "@/lib/utils";
import { fail, ok, readString, toMessage, type ActionState } from "@/actions/shared";

/**
 * La clienta se identifica solo con su teléfono. Si ya existe, entra directo;
 * si no, se le pide el nombre una vez y queda registrada.
 */
export async function clientIdentifyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const phone = normalizePhone(readString(formData, "phone"));
    const name = readString(formData, "name");

    if (phone.length < 10) return fail("Ese número no parece completo.");

    const existing = await prisma.client.findUnique({ where: { phone } });

    if (existing) {
      if (!existing.active) {
        await prisma.client.update({ where: { id: existing.id }, data: { active: true } });
      }
      await setClientSession(existing.id);
      revalidatePath("/reservar");
      return ok("Bienvenida de vuelta.");
    }

    if (!name) {
      // Primera vez: el formulario vuelve a pintarse pidiendo el nombre.
      return { error: "NEEDS_NAME" };
    }

    const client = await prisma.client.create({ data: { name, phone } });
    await setClientSession(client.id);
    revalidatePath("/reservar");
    revalidatePath("/panel/clientes");
    return ok("Cuenta creada.");
  } catch (error) {
    return fail(toMessage(error));
  }
}

/** La clienta cancela su propia cita. Solo si aún no ha pasado. */
export async function clientCancelAppointmentAction(formData: FormData) {
  const client = await getCurrentClient();
  if (!client) return;

  const id = readString(formData, "id");
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { clientId: true, startAt: true, status: true },
  });

  if (!appointment) return;
  if (appointment.clientId !== client.id) return;
  if (appointment.startAt < new Date()) return;
  if (appointment.status === "ATTENDED") return;

  await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED", cancelReason: "Cancelada por la clienta" },
  });

  revalidatePath("/reservar");
  revalidatePath("/panel/agenda");
  revalidatePath("/panel");
}

/**
 * La clienta mueve su cita de día o de hora.
 *
 * Antes solo podía cancelarla y volver a empezar, y para cuando volvía el
 * hueco podía haberlo cogido otra. Se mueve la misma cita: los servicios y
 * la especialista no cambian, solo cuándo.
 */
export async function clientRescheduleAction(input: {
  id: string;
  day: string;
  time: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = await getCurrentClient();
    if (!client) return { ok: false, error: "Tu sesión caducó. Escribe tu teléfono de nuevo." };

    const cita = await prisma.appointment.findUnique({
      where: { id: input.id },
      select: {
        clientId: true,
        startAt: true,
        status: true,
        specialistId: true,
        services: { select: { service: { select: { id: true, durationMin: true } } } },
      },
    });

    if (!cita || cita.clientId !== client.id) return { ok: false, error: "Esa cita no es tuya." };
    if (cita.startAt < new Date()) return { ok: false, error: "Esa cita ya pasó." };
    if (cita.status === "ATTENDED" || cita.status === "CANCELLED") {
      return { ok: false, error: "Esa cita ya no se puede mover." };
    }

    const settings = await getSettings();
    const durationMin = cita.services.reduce((s, x) => s + x.service.durationMin, 0) || 30;

    // Se comprueba contra la misma disponibilidad que ve el calendario, y sin
    // contarse a sí misma: si no, su propia hora saldría ocupada.
    const disponible = await getAvailability({
      day: input.day,
      durationMin,
      specialistId: cita.specialistId,
      serviceIds: cita.services.map((x) => x.service.id),
      excludeAppointmentId: input.id,
    });
    if (!disponible.slots.some((s) => s.time === input.time)) {
      return { ok: false, error: "Esa hora se acaba de ocupar. Elige otra, por favor." };
    }

    const startAt = tzDateTimeToUtc(input.day, input.time, settings.timezone);
    await prisma.appointment.update({
      where: { id: input.id },
      data: {
        startAt,
        endAt: new Date(startAt.getTime() + durationMin * 60_000),
        // Movida por la clienta: vuelve a quedar pendiente de confirmar salvo
        // que el estudio confirme solo.
        status: settings.autoConfirm ? "CONFIRMED" : "PENDING",
      },
    });

    revalidatePath("/reservar");
    revalidatePath("/reservar/mis-citas");
    revalidatePath("/panel/agenda");
    revalidatePath("/panel");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

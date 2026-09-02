import { withUser } from "@/lib/api";
import { getReminders } from "@/data/reminders";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { ReminderKind } from "@/generated/prisma/client";

/**
 * Los recordatorios pendientes. La app no envía nada sola: arma el mensaje
 * y abre WhatsApp para que la dueña lo revise y pulse enviar.
 */
export const GET = withUser(async () => {
  const [{ pending, counts }, settings] = await Promise.all([getReminders(), getSettings()]);

  return {
    contadores: {
      total: counts.total,
      citas: counts.appointments,
      sesiones: counts.sessions,
      deudas: counts.debts,
      cumpleanos: counts.birthdays,
    },
    negocio: { nombre: settings.businessName, prefijo: settings.countryCode },
    recordatorios: pending.map((item) => ({
      clave: item.key,
      tipo: item.kind,
      titulo: item.title,
      detalle: item.detail,
      cuando: item.when?.toISOString() ?? null,
      urgente: item.urgent,
      montoCentavos: item.amountCents ?? null,
      servicio: item.serviceName ?? null,
      citaId: item.appointmentId ?? null,
      clienta: { id: item.clientId, nombre: item.clientName, telefono: item.clientPhone },
    })),
  };
});

/** Marca uno como enviado para que no vuelva a salir en la lista. */
export const POST = withUser(async ({ request }) => {
  const body = (await request.json()) as {
    tipo?: string;
    clientaId?: string;
    citaId?: string | null;
    nota?: string | null;
  };

  if (!body.tipo || !body.clientaId) throw new Error("Falta el recordatorio.");

  await prisma.reminderLog.create({
    data: {
      kind: body.tipo as ReminderKind,
      clientId: body.clientaId,
      appointmentId: body.citaId || null,
      note: body.nota || null,
    },
  });

  if (body.citaId) {
    await prisma.appointment.update({
      where: { id: body.citaId },
      data: { reminderSentAt: new Date() },
    });
  }

  return { marcado: true };
});

export { OPTIONS } from "@/lib/api";

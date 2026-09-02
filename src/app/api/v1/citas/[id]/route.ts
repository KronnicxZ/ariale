import { withUserParams } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getAppointment } from "@/data/agenda";
import { serializeAppointment } from "@/lib/api-serializers";
import { getSettings } from "@/lib/settings";
import { tzDateTimeToUtc } from "@/lib/date";
import type { AppointmentStatus } from "@/generated/prisma/client";

const STATUSES = new Set(["PENDING", "CONFIRMED", "ATTENDED", "CANCELLED", "NO_SHOW"]);

export const GET = withUserParams<{ id: string }, unknown>(async ({ params }) => {
  const appointment = await getAppointment(params.id);
  if (!appointment) throw new Error("Esa cita ya no existe.");

  return {
    cita: {
      ...serializeAppointment(appointment),
      clienta: {
        id: appointment.client.id,
        nombre: appointment.client.name,
        telefono: appointment.client.phone,
        correo: appointment.client.email,
        notas: appointment.client.notes,
        alergias: appointment.client.allergies,
      },
      venta: appointment.sale
        ? {
            id: appointment.sale.id,
            numero: appointment.sale.number,
            totalCentavos: appointment.sale.totalCents,
            cobradoCentavos: appointment.sale.paidCents,
            estado: appointment.sale.status,
          }
        : null,
    },
  };
});

/** Cambia el estado o reprograma. Ambas cosas pasan por aquí. */
export const PATCH = withUserParams<{ id: string }, unknown>(async ({ request, params }) => {
  const body = (await request.json()) as {
    estado?: string;
    dia?: string;
    hora?: string;
    motivoCancelacion?: string;
  };

  if (body.estado) {
    if (!STATUSES.has(body.estado)) throw new Error("Estado no válido.");
    await prisma.appointment.update({
      where: { id: params.id },
      data: {
        status: body.estado as AppointmentStatus,
        ...(body.estado === "CANCELLED"
          ? { cancelReason: body.motivoCancelacion ?? null }
          : {}),
      },
    });
  }

  if (body.dia && body.hora) {
    const settings = await getSettings();
    const current = await prisma.appointment.findUniqueOrThrow({
      where: { id: params.id },
      include: { services: true },
    });
    const duration = current.services.reduce((sum, s) => sum + s.durationMin, 0);
    const startAt = tzDateTimeToUtc(body.dia, body.hora, settings.timezone);
    const endAt = new Date(startAt.getTime() + duration * 60_000);

    const clash = await prisma.appointment.findFirst({
      where: {
        id: { not: params.id },
        specialistId: current.specialistId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });
    if (clash) throw new Error("Ese horario ya está ocupado.");

    await prisma.appointment.update({ where: { id: params.id }, data: { startAt, endAt } });
  }

  const updated = await prisma.appointment.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      specialist: { select: { id: true, name: true, color: true } },
      services: { include: { service: { select: { name: true } } } },
      sale: { select: { id: true, status: true } },
    },
  });

  return { cita: serializeAppointment(updated) };
});

export const DELETE = withUserParams<{ id: string }, unknown>(async ({ params }) => {
  await prisma.appointment.delete({ where: { id: params.id } });
  return { ok: true };
});

export { OPTIONS } from "@/lib/api";

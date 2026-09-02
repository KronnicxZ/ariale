import { withUser } from "@/lib/api";
import { createAppointment, findOrCreateClient } from "@/actions/appointments";
import { serializeAppointment } from "@/lib/api-serializers";
import { prisma } from "@/lib/db";

type Body = {
  clientaId?: string;
  /** Alta rápida: si no hay id, se crea con nombre y teléfono. */
  clientaNombre?: string;
  clientaTelefono?: string;
  especialistaId?: string;
  servicioIds?: string[];
  dia?: string;
  hora?: string;
  nota?: string;
  confirmada?: boolean;
};

/** Agenda una cita desde la app. Valida el solape igual que la web. */
export const POST = withUser(async ({ request }) => {
  const body = (await request.json()) as Body;

  if (!body.especialistaId) throw new Error("Elige una especialista.");
  if (!body.servicioIds?.length) throw new Error("Elige al menos un servicio.");
  if (!body.dia || !body.hora) throw new Error("Elige el día y la hora.");

  const client = body.clientaId
    ? { id: body.clientaId }
    : await findOrCreateClient(body.clientaNombre ?? "", body.clientaTelefono ?? "");

  const appointment = await createAppointment({
    clientId: client.id,
    specialistId: body.especialistaId,
    serviceIds: body.servicioIds,
    day: body.dia,
    time: body.hora,
    note: body.nota ?? null,
    source: "ADMIN",
    status: body.confirmada === false ? "PENDING" : "CONFIRMED",
  });

  // Releemos con la venta incluida para devolver la misma forma que el resto.
  const full = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointment.id },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      specialist: { select: { id: true, name: true, color: true } },
      services: { include: { service: { select: { name: true } } } },
      sale: { select: { id: true, status: true } },
    },
  });

  return { cita: serializeAppointment(full) };
});

export { OPTIONS } from "@/lib/api";

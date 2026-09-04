import "server-only";

/**
 * Convierte los registros de Prisma a la forma que consume la app.
 *
 * Reglas: las fechas viajan en ISO (UTC) y la app las presenta en la zona del
 * salón; el dinero siempre en centavos. Los nombres van en español para que
 * el código Dart se lea igual que el resto del producto.
 */

type AppointmentLike = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: string;
  source?: string;
  note: string | null;
  /** Solo lo traen las consultas de detalle; las listas no lo piden. */
  referenceUrl?: string | null;
  client: { id: string; name: string; phone: string };
  specialist: { id: string; name: string; color: string };
  services: { priceCents: number; durationMin: number; service: { name: string } }[];
  sale?: { id: string; status: string } | null;
};

export function serializeAppointment(appointment: AppointmentLike) {
  const totalCents = appointment.services.reduce((sum, s) => sum + s.priceCents, 0);
  const duracionMin = appointment.services.reduce((sum, s) => sum + s.durationMin, 0);

  return {
    id: appointment.id,
    inicio: appointment.startAt.toISOString(),
    fin: appointment.endAt.toISOString(),
    estado: appointment.status,
    origen: appointment.source ?? "ADMIN",
    nota: appointment.note,
    disenoUrl: appointment.referenceUrl ?? null,
    clienta: {
      id: appointment.client.id,
      nombre: appointment.client.name,
      telefono: appointment.client.phone,
    },
    especialista: {
      id: appointment.specialist.id,
      nombre: appointment.specialist.name,
      color: appointment.specialist.color,
    },
    servicios: appointment.services.map((s) => ({
      nombre: s.service.name,
      precioCentavos: s.priceCents,
      duracionMin: s.durationMin,
    })),
    totalCentavos: totalCents,
    duracionMin,
    ventaId: appointment.sale?.id ?? null,
    ventaEstado: appointment.sale?.status ?? null,
  };
}

type SaleLike = {
  id: string;
  number: number;
  date: Date;
  totalCents: number;
  paidCents: number;
  status: string;
  dueDate: Date | null;
  client: { id: string; name: string; phone: string };
  specialist?: { id: string; name: string } | null;
  items?: { description: string; totalCents: number }[];
};

export function serializeSale(sale: SaleLike) {
  return {
    id: sale.id,
    numero: sale.number,
    fecha: sale.date.toISOString(),
    totalCentavos: sale.totalCents,
    cobradoCentavos: sale.paidCents,
    saldoCentavos: sale.totalCents - sale.paidCents,
    estado: sale.status,
    vence: sale.dueDate?.toISOString() ?? null,
    clienta: {
      id: sale.client.id,
      nombre: sale.client.name,
      telefono: sale.client.phone,
    },
    especialista: sale.specialist
      ? { id: sale.specialist.id, nombre: sale.specialist.name }
      : null,
    concepto: sale.items?.map((i) => i.description).join(", ") ?? "",
  };
}

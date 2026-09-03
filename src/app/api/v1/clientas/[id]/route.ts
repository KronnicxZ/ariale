import { withUserParams } from "@/lib/api";
import { getClientProfile } from "@/data/clients";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/utils";

/** Ficha completa: historial, saldo, bonos y qué sesión le toca repetir. */
export const GET = withUserParams<{ id: string }, unknown>(async ({ params }) => {
  const perfil = await getClientProfile(params.id);
  if (!perfil) throw new Error("Esa clienta ya no existe.");

  const { client, stats, upcoming, dueSessions } = perfil;

  return {
    clienta: {
      id: client.id,
      nombre: client.name,
      telefono: client.phone,
      correo: client.email,
      instagram: client.instagram,
      cumple: client.birthday?.toISOString() ?? null,
      notas: client.notes,
      alergias: client.allergies,
      activa: client.active,
      desde: client.createdAt.toISOString(),
    },
    resumen: {
      visitas: stats.visits,
      gastadoCentavos: stats.totalSpentCents,
      saldoCentavos: stats.balanceCents,
      ticketCentavos: stats.ticketAvgCents,
      primeraVisita: stats.firstVisitAt?.toISOString() ?? null,
      ultimaVisita: stats.lastVisitAt?.toISOString() ?? null,
    },
    // La más cercana primero: es la que importa.
    proximas: [...upcoming].reverse().map((cita) => ({
      id: cita.id,
      inicio: cita.startAt.toISOString(),
      estado: cita.status,
      especialista: cita.specialist.name,
      servicios: cita.services.map((s) => s.service.name),
    })),
    historial: client.appointments.slice(0, 30).map((cita) => ({
      id: cita.id,
      inicio: cita.startAt.toISOString(),
      estado: cita.status,
      especialista: cita.specialist.name,
      especialistaId: cita.specialistId,
      servicios: cita.services.map((s) => s.service.name),
      // Con esto la app puede repetir la última cita de un toque.
      servicioIds: cita.services.map((s) => s.serviceId),
      totalCentavos: cita.services.reduce((suma, s) => suma + s.priceCents, 0),
    })),
    ventas: client.sales.slice(0, 30).map((venta) => ({
      id: venta.id,
      numero: venta.number,
      fecha: venta.date.toISOString(),
      estado: venta.status,
      totalCentavos: venta.totalCents,
      cobradoCentavos: venta.paidCents,
      saldoCentavos: venta.totalCents - venta.paidCents,
      concepto: venta.items.map((i) => i.description).join(", "),
    })),
    bonos: client.packages.map((bono) => ({
      id: bono.id,
      nombre: bono.package.name,
      sesiones: bono.sessionsTotal,
      usadas: bono.sessionsUsed,
      restantes: Math.max(0, bono.sessionsTotal - bono.sessionsUsed),
      estado: bono.status,
      vence: bono.expiresAt.toISOString(),
      servicioIds: bono.package.services.map((s) => s.serviceId),
    })),
    tocaRepetir: dueSessions.map((s) => ({
      servicio: s.serviceName,
      ultima: s.lastAt.toISOString(),
      toca: s.dueAt.toISOString(),
    })),
  };
});

export const PATCH = withUserParams<{ id: string }, unknown>(async ({ request, params }) => {
  const body = (await request.json()) as {
    nombre?: string;
    telefono?: string;
    correo?: string | null;
    instagram?: string | null;
    notas?: string | null;
    alergias?: string | null;
    activa?: boolean;
  };

  if (body.nombre !== undefined && body.nombre.trim().length < 2) {
    throw new Error("Escribe el nombre de la clienta.");
  }

  // El teléfono es la llave de la clienta: si cambia, no puede chocar con otra.
  let phone: string | undefined;
  if (body.telefono !== undefined) {
    phone = normalizePhone(body.telefono);
    if (phone.length < 10) throw new Error("El teléfono debe tener al menos 10 dígitos.");
    const otra = await prisma.client.findUnique({ where: { phone } });
    if (otra && otra.id !== params.id) throw new Error(`Ese teléfono ya es de ${otra.name}.`);
  }

  await prisma.client.update({
    where: { id: params.id },
    data: {
      ...(body.nombre !== undefined ? { name: body.nombre.trim() } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(body.correo !== undefined ? { email: body.correo?.trim() || null } : {}),
      ...(body.instagram !== undefined
        ? { instagram: body.instagram?.replace("@", "").trim() || null }
        : {}),
      ...(body.notas !== undefined ? { notes: body.notas?.trim() || null } : {}),
      ...(body.alergias !== undefined ? { allergies: body.alergias?.trim() || null } : {}),
      ...(body.activa !== undefined ? { active: body.activa } : {}),
    },
  });

  return { guardado: true };
});

export { OPTIONS } from "@/lib/api";

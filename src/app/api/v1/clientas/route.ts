import { param, withUser } from "@/lib/api";
import { getClients, type ClientFilter, type ClientSort } from "@/data/clients";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/utils";

const FILTERS = new Set([
  "todas",
  "activas",
  "inactivas",
  "con-cita",
  "con-saldo",
  "nuevas",
  "con-bono",
]);
const SORTS = new Set(["recientes", "nombre", "gasto", "ultima-visita"]);

export const GET = withUser(async ({ request }) => {
  const rawFilter = param(request, "filtro");
  const rawSort = param(request, "orden");

  const { clients, stats } = await getClients({
    query: param(request, "q"),
    filter: (rawFilter && FILTERS.has(rawFilter) ? rawFilter : "todas") as ClientFilter,
    sort: (rawSort && SORTS.has(rawSort) ? rawSort : "recientes") as ClientSort,
  });

  return {
    resumen: {
      total: stats.total,
      activas: stats.active,
      inactivas: stats.inactive,
      conSaldo: stats.withBalance,
      nuevasDelMes: stats.newThisMonth,
    },
    clientas: clients.map((c) => ({
      id: c.id,
      nombre: c.name,
      telefono: c.phone,
      correo: c.email,
      activa: c.active,
      alergias: c.allergies,
      visitas: c.salesCount,
      gastadoCentavos: c.totalSpentCents,
      saldoCentavos: c.balanceCents,
      ultimaVisita: c.lastVisitAt?.toISOString() ?? null,
      proximaCita: c.nextAppointmentAt?.toISOString() ?? null,
      citasProximas: c.upcomingCount,
      sesionesBono: c.packageSessions,
    })),
  };
});

export const POST = withUser(async ({ request }) => {
  const body = (await request.json()) as {
    nombre?: string;
    telefono?: string;
    correo?: string;
    instagram?: string;
    notas?: string;
    alergias?: string;
  };

  const name = body.nombre?.trim() ?? "";
  const phone = normalizePhone(body.telefono ?? "");
  if (name.length < 2) throw new Error("Escribe el nombre de la clienta.");
  if (phone.length < 10) throw new Error("El teléfono debe tener al menos 10 dígitos.");

  const duplicate = await prisma.client.findUnique({ where: { phone } });
  if (duplicate) throw new Error(`Ese teléfono ya es de ${duplicate.name}.`);

  const client = await prisma.client.create({
    data: {
      name,
      phone,
      email: body.correo?.trim() || null,
      instagram: body.instagram?.replace("@", "").trim() || null,
      notes: body.notas?.trim() || null,
      allergies: body.alergias?.trim() || null,
    },
  });

  return {
    clienta: { id: client.id, nombre: client.name, telefono: client.phone },
  };
});

export { OPTIONS } from "@/lib/api";

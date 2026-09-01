import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { normalizePhone } from "@/lib/utils";

export type ClientFilter =
  | "todas"
  | "activas"
  | "inactivas"
  | "con-cita"
  | "con-saldo"
  | "nuevas"
  | "con-bono";

export type ClientSort = "recientes" | "nombre" | "gasto" | "ultima-visita";

/**
 * Directorio de clientas con sus métricas. Se calculan de una sola pasada
 * para no hacer una consulta por tarjeta.
 */
export async function getClients(options: {
  query?: string;
  filter?: ClientFilter;
  sort?: ClientSort;
}) {
  const { query, filter = "todas", sort = "recientes" } = options;

  const where: Prisma.ClientWhereInput = {};

  if (query) {
    const digits = normalizePhone(query);
    where.OR = [
      { name: { contains: query } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
      { email: { contains: query } },
    ];
  }

  if (filter === "activas") where.active = true;
  if (filter === "inactivas") where.active = false;
  if (filter === "nuevas") {
    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    where.createdAt = { gte: monthAgo };
  }
  if (filter === "con-cita") {
    where.appointments = {
      some: { startAt: { gte: new Date() }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
    };
  }
  if (filter === "con-saldo") {
    where.sales = { some: { status: { in: ["PENDING", "PARTIAL"] } } };
  }
  if (filter === "con-bono") {
    where.packages = { some: { status: "ACTIVE", expiresAt: { gte: new Date() } } };
  }

  const clients = await prisma.client.findMany({
    where,
    orderBy: sort === "nombre" ? { name: "asc" } : { createdAt: "desc" },
    include: {
      sales: {
        where: { status: { not: "CANCELLED" } },
        select: { totalCents: true, paidCents: true, date: true },
      },
      appointments: {
        where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        orderBy: { startAt: "desc" },
        select: { startAt: true, status: true },
      },
      packages: {
        where: { status: "ACTIVE", expiresAt: { gte: new Date() } },
        select: { sessionsTotal: true, sessionsUsed: true },
      },
    },
  });

  const now = new Date();
  const enriched = clients.map((client) => {
    const totalSpentCents = client.sales.reduce((sum, s) => sum + s.paidCents, 0);
    const balanceCents = client.sales.reduce((sum, s) => sum + s.totalCents - s.paidCents, 0);
    const lastVisit = client.appointments.find((a) => a.startAt < now && a.status === "ATTENDED");
    const nextAppointment = [...client.appointments].reverse().find((a) => a.startAt >= now);
    const packageSessions = client.packages.reduce(
      (sum, p) => sum + (p.sessionsTotal - p.sessionsUsed),
      0,
    );

    return {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      active: client.active,
      createdAt: client.createdAt,
      allergies: client.allergies,
      salesCount: client.sales.length,
      totalSpentCents,
      balanceCents,
      lastVisitAt: lastVisit?.startAt ?? null,
      nextAppointmentAt: nextAppointment?.startAt ?? null,
      upcomingCount: client.appointments.filter((a) => a.startAt >= now).length,
      packageSessions,
    };
  });

  if (sort === "gasto") enriched.sort((a, b) => b.totalSpentCents - a.totalSpentCents);
  if (sort === "ultima-visita") {
    enriched.sort(
      (a, b) => (b.lastVisitAt?.getTime() ?? 0) - (a.lastVisitAt?.getTime() ?? 0),
    );
  }

  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const stats = {
    total: enriched.length,
    active: enriched.filter((c) => c.active).length,
    inactive: enriched.filter((c) => !c.active).length,
    withBalance: enriched.filter((c) => c.balanceCents > 0).length,
    newThisMonth: enriched.filter((c) => c.createdAt >= monthAgo).length,
  };

  return { clients: enriched, stats };
}

export async function getClientProfile(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      appointments: {
        orderBy: { startAt: "desc" },
        include: {
          specialist: { select: { name: true, color: true } },
          services: { include: { service: { select: { name: true, bodyZone: true } } } },
        },
      },
      sales: {
        orderBy: { date: "desc" },
        include: {
          items: { select: { description: true, totalCents: true } },
          payments: { select: { amountCents: true, date: true, method: true } },
        },
      },
      packages: {
        orderBy: { purchasedAt: "desc" },
        include: {
          package: {
            include: { services: { include: { service: { select: { name: true } } } } },
          },
        },
      },
    },
  });

  if (!client) return null;

  const now = new Date();
  const attended = client.appointments.filter((a) => a.status === "ATTENDED");
  const totalSpentCents = client.sales.reduce((sum, s) => sum + s.paidCents, 0);
  const balanceCents = client.sales.reduce(
    (sum, s) => (s.status === "CANCELLED" ? sum : sum + s.totalCents - s.paidCents),
    0,
  );

  // Qué servicio de depilación toca repetir, según el ciclo de cada zona.
  const dueSessions: { serviceName: string; lastAt: Date; dueAt: Date }[] = [];
  const seen = new Set<string>();
  for (const appointment of attended) {
    for (const entry of appointment.services) {
      const service = entry.service;
      if (!service.bodyZone || seen.has(service.name)) continue;
      seen.add(service.name);
      const full = await prisma.service.findFirst({
        where: { name: service.name },
        select: { sessionIntervalDays: true },
      });
      if (!full?.sessionIntervalDays) continue;
      const dueAt = new Date(
        appointment.startAt.getTime() + full.sessionIntervalDays * 86_400_000,
      );
      dueSessions.push({ serviceName: service.name, lastAt: appointment.startAt, dueAt });
    }
  }

  return {
    client,
    stats: {
      visits: attended.length,
      totalSpentCents,
      balanceCents,
      ticketAvgCents: attended.length > 0 ? Math.round(totalSpentCents / attended.length) : 0,
      firstVisitAt: attended.at(-1)?.startAt ?? null,
      lastVisitAt: attended.at(0)?.startAt ?? null,
    },
    upcoming: client.appointments.filter(
      (a) => a.startAt >= now && a.status !== "CANCELLED" && a.status !== "NO_SHOW",
    ),
    dueSessions: dueSessions.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()),
  };
}

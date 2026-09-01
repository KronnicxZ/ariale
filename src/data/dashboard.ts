import "server-only";
import { prisma } from "@/lib/db";
import type { Period } from "@/lib/date";
import { TZ, addDays, dayKey, endOfDayUtc, previousPeriod, startOfDayUtc } from "@/lib/date";

/**
 * Los números del panel.
 *
 * Criterio contable: las VENTAS se reconocen por fecha de la venta (devengado),
 * los COBROS por fecha del pago (caja). Por eso "ventas" y "cobrado" pueden no
 * coincidir en un mismo periodo, y esa diferencia es justamente la cartera.
 */

export type Kpis = {
  salesCents: number;
  salesCount: number;
  clientsServed: number;
  collectedCents: number;
  expensesCents: number;
  purchasesCents: number;
  costsCents: number;
  netProfitCents: number;
  marginPct: number;
  cashFlowCents: number;
  collectionRatePct: number;
  ticketAvgCents: number;
};

async function kpisFor(period: Period): Promise<Kpis> {
  const range = { gte: period.from, lte: period.to };

  const [sales, payments, expenses, purchases] = await Promise.all([
    prisma.sale.aggregate({
      where: { date: range, status: { not: "CANCELLED" } },
      _sum: { totalCents: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { date: range, sale: { status: { not: "CANCELLED" } } },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({ where: { date: range }, _sum: { amountCents: true } }),
    prisma.purchase.aggregate({
      where: { date: range, status: { not: "CANCELLED" } },
      _sum: { totalCents: true },
    }),
  ]);

  const distinctClients = await prisma.sale.findMany({
    where: { date: range, status: { not: "CANCELLED" } },
    select: { clientId: true },
    distinct: ["clientId"],
  });

  const salesCents = sales._sum.totalCents ?? 0;
  const salesCount = sales._count;
  const collectedCents = payments._sum.amountCents ?? 0;
  const expensesCents = expenses._sum.amountCents ?? 0;
  const purchasesCents = purchases._sum.totalCents ?? 0;
  const costsCents = expensesCents + purchasesCents;

  return {
    salesCents,
    salesCount,
    clientsServed: distinctClients.length,
    collectedCents,
    expensesCents,
    purchasesCents,
    costsCents,
    netProfitCents: salesCents - costsCents,
    marginPct: salesCents > 0 ? ((salesCents - costsCents) / salesCents) * 100 : 0,
    cashFlowCents: collectedCents - costsCents,
    collectionRatePct: salesCents > 0 ? (collectedCents / salesCents) * 100 : 0,
    ticketAvgCents: salesCount > 0 ? Math.round(salesCents / salesCount) : 0,
  };
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export async function getDashboard(period: Period, tz = TZ) {
  const prev = previousPeriod(period);
  const now = new Date();
  const todayStart = startOfDayUtc(dayKey(now, tz), tz);
  const todayEnd = endOfDayUtc(dayKey(now, tz), tz);

  const [current, previous, receivable, payable, overdue, todayAppointments, pendingAppointments] =
    await Promise.all([
      kpisFor(period),
      kpisFor(prev),
      // Cartera total, no la del periodo: lo que el salón tiene en la calle hoy.
      prisma.sale.findMany({
        where: { status: { in: ["PENDING", "PARTIAL"] } },
        select: { totalCents: true, paidCents: true, dueDate: true },
      }),
      prisma.purchase.findMany({
        where: { status: { in: ["PENDING", "PARTIAL"] } },
        select: { totalCents: true, paidCents: true, dueDate: true },
      }),
      prisma.sale.count({
        where: { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: now } },
      }),
      prisma.appointment.findMany({
        where: {
          startAt: { gte: todayStart, lte: todayEnd },
          status: { notIn: ["CANCELLED"] },
        },
        orderBy: { startAt: "asc" },
        include: {
          client: { select: { id: true, name: true, phone: true } },
          specialist: { select: { id: true, name: true, color: true } },
          services: { include: { service: { select: { name: true } } } },
        },
      }),
      prisma.appointment.count({
        where: { status: "PENDING", startAt: { gte: now } },
      }),
    ]);

  const receivableCents = receivable.reduce((sum, s) => sum + s.totalCents - s.paidCents, 0);
  const payableCents = payable.reduce((sum, p) => sum + p.totalCents - p.paidCents, 0);

  return {
    kpis: current,
    deltas: {
      sales: pctChange(current.salesCents, previous.salesCents),
      profit: pctChange(current.netProfitCents, previous.netProfitCents),
      collected: pctChange(current.collectedCents, previous.collectedCents),
      costs: pctChange(current.costsCents, previous.costsCents),
    },
    portfolio: { receivableCents, payableCents, overdueCount: overdue },
    todayAppointments,
    pendingAppointments,
  };
}

/** Serie diaria de ventas y cobros para el gráfico del dashboard. */
export async function getSalesSeries(period: Period, tz = TZ) {
  const [sales, payments] = await Promise.all([
    prisma.sale.findMany({
      where: { date: { gte: period.from, lte: period.to }, status: { not: "CANCELLED" } },
      select: { date: true, totalCents: true },
    }),
    prisma.payment.findMany({
      where: { date: { gte: period.from, lte: period.to } },
      select: { date: true, amountCents: true },
    }),
  ]);

  const buckets = new Map<string, { day: string; ventas: number; cobrado: number }>();

  const spanDays = Math.ceil((period.to.getTime() - period.from.getTime()) / 86_400_000);
  const maxDays = Math.min(Math.max(spanDays, 1), 120);
  for (let i = 0; i <= maxDays; i++) {
    const key = dayKey(addDays(period.from, i), tz);
    if (!buckets.has(key)) buckets.set(key, { day: key, ventas: 0, cobrado: 0 });
  }

  for (const sale of sales) {
    const key = dayKey(sale.date, tz);
    const bucket = buckets.get(key);
    if (bucket) bucket.ventas += sale.totalCents;
  }
  for (const payment of payments) {
    const key = dayKey(payment.date, tz);
    const bucket = buckets.get(key);
    if (bucket) bucket.cobrado += payment.amountCents;
  }

  return [...buckets.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Reparto de ventas por categoría de servicio — cuánto pesa la depilación. */
export async function getCategoryBreakdown(period: Period) {
  const items = await prisma.saleItem.findMany({
    where: {
      sale: { date: { gte: period.from, lte: period.to }, status: { not: "CANCELLED" } },
      serviceId: { not: null },
    },
    select: {
      totalCents: true,
      service: { select: { category: { select: { id: true, name: true, color: true } } } },
    },
  });

  const map = new Map<string, { name: string; color: string; totalCents: number; count: number }>();
  for (const item of items) {
    const category = item.service?.category;
    if (!category) continue;
    const entry = map.get(category.id) ?? {
      name: category.name,
      color: category.color,
      totalCents: 0,
      count: 0,
    };
    entry.totalCents += item.totalCents;
    entry.count += 1;
    map.set(category.id, entry);
  }

  return [...map.values()].sort((a, b) => b.totalCents - a.totalCents);
}

/** Ranking de servicios más vendidos del periodo. */
export async function getTopServices(period: Period, limit = 6) {
  const grouped = await prisma.saleItem.groupBy({
    by: ["serviceId"],
    where: {
      sale: { date: { gte: period.from, lte: period.to }, status: { not: "CANCELLED" } },
      serviceId: { not: null },
    },
    _sum: { totalCents: true, quantity: true },
    orderBy: { _sum: { totalCents: "desc" } },
    take: limit,
  });

  const services = await prisma.service.findMany({
    where: { id: { in: grouped.map((g) => g.serviceId!).filter(Boolean) } },
    select: { id: true, name: true, category: { select: { name: true, color: true } } },
  });
  const byId = new Map(services.map((s) => [s.id, s]));

  return grouped.map((g) => ({
    id: g.serviceId!,
    name: byId.get(g.serviceId!)?.name ?? "Servicio eliminado",
    category: byId.get(g.serviceId!)?.category?.name ?? "",
    color: byId.get(g.serviceId!)?.category?.color ?? "#E9B21C",
    totalCents: g._sum.totalCents ?? 0,
    quantity: g._sum.quantity ?? 0,
  }));
}

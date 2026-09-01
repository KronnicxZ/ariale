import "server-only";
import { prisma } from "@/lib/db";
import type { Period } from "@/lib/date";
import { TZ, dayKey } from "@/lib/date";

export async function getSalesByClient(period: Period) {
  const sales = await prisma.sale.findMany({
    where: { date: { gte: period.from, lte: period.to }, status: { not: "CANCELLED" } },
    include: { client: { select: { id: true, name: true, phone: true } } },
  });

  const map = new Map<
    string,
    { id: string; name: string; phone: string; count: number; totalCents: number; paidCents: number }
  >();

  for (const sale of sales) {
    const entry = map.get(sale.clientId) ?? {
      id: sale.client.id,
      name: sale.client.name,
      phone: sale.client.phone,
      count: 0,
      totalCents: 0,
      paidCents: 0,
    };
    entry.count += 1;
    entry.totalCents += sale.totalCents;
    entry.paidCents += sale.paidCents;
    map.set(sale.clientId, entry);
  }

  return [...map.values()]
    .map((row) => ({ ...row, pendingCents: row.totalCents - row.paidCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export async function getSalesByService(period: Period) {
  const items = await prisma.saleItem.findMany({
    where: {
      sale: { date: { gte: period.from, lte: period.to }, status: { not: "CANCELLED" } },
    },
    include: {
      service: { select: { id: true, name: true, category: { select: { name: true, color: true } } } },
    },
  });

  const map = new Map<
    string,
    { name: string; category: string; color: string; quantity: number; totalCents: number }
  >();

  for (const item of items) {
    const key = item.serviceId ?? `libre:${item.description}`;
    const entry = map.get(key) ?? {
      name: item.service?.name ?? item.description,
      category: item.service?.category?.name ?? "Sin categoría",
      color: item.service?.category?.color ?? "#999999",
      quantity: 0,
      totalCents: 0,
    };
    entry.quantity += item.quantity;
    entry.totalCents += item.totalCents;
    map.set(key, entry);
  }

  return [...map.values()].sort((a, b) => b.totalCents - a.totalCents);
}

export async function getSalesBySpecialist(period: Period) {
  const sales = await prisma.sale.findMany({
    where: { date: { gte: period.from, lte: period.to }, status: { not: "CANCELLED" } },
    include: { specialist: { select: { id: true, name: true, color: true } } },
  });

  const map = new Map<
    string,
    { name: string; color: string; count: number; totalCents: number }
  >();

  for (const sale of sales) {
    const key = sale.specialistId ?? "sin";
    const entry = map.get(key) ?? {
      name: sale.specialist?.name ?? "Sin asignar",
      color: sale.specialist?.color ?? "#999999",
      count: 0,
      totalCents: 0,
    };
    entry.count += 1;
    entry.totalCents += sale.totalCents;
    map.set(key, entry);
  }

  return [...map.values()].sort((a, b) => b.totalCents - a.totalCents);
}

/** Serie mensual de ingresos y costos, para ver la tendencia del negocio. */
export async function getMonthlySummary(months = 12, tz = TZ) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const [sales, expenses, purchases] = await Promise.all([
    prisma.sale.findMany({
      where: { date: { gte: from }, status: { not: "CANCELLED" } },
      select: { date: true, totalCents: true, paidCents: true },
    }),
    prisma.expense.findMany({ where: { date: { gte: from } }, select: { date: true, amountCents: true } }),
    prisma.purchase.findMany({
      where: { date: { gte: from }, status: { not: "CANCELLED" } },
      select: { date: true, totalCents: true },
    }),
  ]);

  const buckets = new Map<
    string,
    { month: string; label: string; ventas: number; cobrado: number; costos: number }
  >();

  for (let i = 0; i < months; i++) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1));
    const key = date.toISOString().slice(0, 7);
    buckets.set(key, {
      month: key,
      label: date.toLocaleDateString("es-VE", { month: "short", year: "2-digit", timeZone: "UTC" }),
      ventas: 0,
      cobrado: 0,
      costos: 0,
    });
  }

  const bucketKey = (date: Date) => dayKey(date, tz).slice(0, 7);

  for (const sale of sales) {
    const bucket = buckets.get(bucketKey(sale.date));
    if (!bucket) continue;
    bucket.ventas += sale.totalCents;
    bucket.cobrado += sale.paidCents;
  }
  for (const expense of expenses) {
    const bucket = buckets.get(bucketKey(expense.date));
    if (bucket) bucket.costos += expense.amountCents;
  }
  for (const purchase of purchases) {
    const bucket = buckets.get(bucketKey(purchase.date));
    if (bucket) bucket.costos += purchase.totalCents;
  }

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    utilidad: bucket.ventas - bucket.costos,
  }));
}

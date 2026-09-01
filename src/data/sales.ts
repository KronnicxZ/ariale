import "server-only";
import { prisma } from "@/lib/db";
import type { Period } from "@/lib/date";
import type { Prisma, SaleStatus } from "@/generated/prisma/client";

export async function getSales(options: {
  period: Period;
  status?: SaleStatus;
  clientQuery?: string;
  specialistId?: string;
}) {
  const where: Prisma.SaleWhereInput = {
    date: { gte: options.period.from, lte: options.period.to },
    ...(options.status ? { status: options.status } : {}),
    ...(options.specialistId ? { specialistId: options.specialistId } : {}),
    ...(options.clientQuery ? { client: { name: { contains: options.clientQuery } } } : {}),
  };

  const [sales, specialists] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        specialist: { select: { id: true, name: true, color: true } },
        items: { select: { description: true, totalCents: true } },
      },
    }),
    prisma.specialist.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  const active = sales.filter((s) => s.status !== "CANCELLED");
  const totals = {
    count: active.length,
    totalCents: active.reduce((sum, s) => sum + s.totalCents, 0),
    paidCents: active.reduce((sum, s) => sum + s.paidCents, 0),
    pendingCents: active.reduce((sum, s) => sum + s.totalCents - s.paidCents, 0),
  };

  return { sales, specialists, totals };
}

export async function getSale(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      specialist: { select: { id: true, name: true } },
      appointment: { select: { id: true, startAt: true } },
      items: {
        include: {
          service: { select: { name: true } },
          clientPackage: { include: { package: { select: { name: true } } } },
        },
      },
      payments: { orderBy: { date: "desc" } },
      packagesSold: { include: { package: { select: { name: true } } } },
    },
  });
}

/** Cuentas por cobrar: ventas con saldo, vencidas primero. */
export async function getReceivables(options: { onlyOpen?: boolean; overdue?: boolean } = {}) {
  const now = new Date();

  const sales = await prisma.sale.findMany({
    where: {
      status: { in: options.onlyOpen === false ? ["PENDING", "PARTIAL", "PAID"] : ["PENDING", "PARTIAL"] },
      ...(options.overdue ? { dueDate: { lt: now } } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { date: "asc" }],
    include: {
      client: { select: { id: true, name: true, phone: true } },
      items: { select: { description: true } },
    },
  });

  const rows = sales.map((sale) => ({
    id: sale.id,
    number: sale.number,
    date: sale.date,
    dueDate: sale.dueDate,
    client: sale.client,
    description: sale.items.map((i) => i.description).join(", ") || `Venta #${sale.number}`,
    totalCents: sale.totalCents,
    paidCents: sale.paidCents,
    balanceCents: sale.totalCents - sale.paidCents,
    status: sale.status,
    overdue: Boolean(sale.dueDate && sale.dueDate < now),
    daysOverdue: sale.dueDate
      ? Math.max(0, Math.floor((now.getTime() - sale.dueDate.getTime()) / 86_400_000))
      : 0,
  }));

  const totals = {
    count: rows.length,
    totalCents: rows.reduce((sum, r) => sum + r.totalCents, 0),
    paidCents: rows.reduce((sum, r) => sum + r.paidCents, 0),
    balanceCents: rows.reduce((sum, r) => sum + r.balanceCents, 0),
    overdueCents: rows.filter((r) => r.overdue).reduce((sum, r) => sum + r.balanceCents, 0),
    overdueCount: rows.filter((r) => r.overdue).length,
  };

  return { rows, totals };
}

/** Cuentas por pagar: compras con saldo. */
export async function getPayables(options: { overdue?: boolean } = {}) {
  const now = new Date();

  const purchases = await prisma.purchase.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      ...(options.overdue ? { dueDate: { lt: now } } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { date: "asc" }],
    include: { supplier: { select: { id: true, name: true, phone: true } } },
  });

  const rows = purchases.map((purchase) => ({
    id: purchase.id,
    number: purchase.number,
    date: purchase.date,
    dueDate: purchase.dueDate,
    supplier: purchase.supplier,
    description: purchase.description,
    totalCents: purchase.totalCents,
    paidCents: purchase.paidCents,
    balanceCents: purchase.totalCents - purchase.paidCents,
    status: purchase.status,
    overdue: Boolean(purchase.dueDate && purchase.dueDate < now),
  }));

  const totals = {
    count: rows.length,
    totalCents: rows.reduce((sum, r) => sum + r.totalCents, 0),
    paidCents: rows.reduce((sum, r) => sum + r.paidCents, 0),
    balanceCents: rows.reduce((sum, r) => sum + r.balanceCents, 0),
    overdueCount: rows.filter((r) => r.overdue).length,
  };

  return { rows, totals };
}

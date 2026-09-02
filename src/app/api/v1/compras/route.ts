import { param, periodParam, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getPayables } from "@/data/sales";
import { nextPurchaseNumber, parseDay, purchaseStatusFor } from "@/lib/sales-core";
import type { PaymentMethod } from "@/generated/prisma/client";

/**
 * Con ?vista=pagar devuelve las cuentas por pagar (compras con saldo);
 * si no, las compras del periodo.
 */
export const GET = withUser(async ({ request }) => {
  if (param(request, "vista") === "pagar") {
    const { rows, totals } = await getPayables({
      overdue: param(request, "estado") === "vencidas",
    });

    return {
      vista: "pagar",
      totales: {
        cuenta: totals.count,
        totalCentavos: totals.totalCents,
        pagadoCentavos: totals.paidCents,
        saldoCentavos: totals.balanceCents,
        vencidas: totals.overdueCount,
      },
      compras: rows.map((r) => ({
        id: r.id,
        numero: r.number,
        fecha: r.date.toISOString(),
        vence: r.dueDate?.toISOString() ?? null,
        descripcion: r.description,
        totalCentavos: r.totalCents,
        pagadoCentavos: r.paidCents,
        saldoCentavos: r.balanceCents,
        estado: r.status,
        vencida: r.overdue,
        proveedor: r.supplier
          ? { id: r.supplier.id, nombre: r.supplier.name, telefono: r.supplier.phone }
          : null,
      })),
    };
  }

  const { period, preset } = periodParam(request, "month");
  const compras = await prisma.purchase.findMany({
    where: { date: { gte: period.from, lte: period.to } },
    orderBy: { date: "desc" },
    include: { supplier: { select: { id: true, name: true, phone: true } } },
  });

  const vivas = compras.filter((c) => c.status !== "CANCELLED");

  return {
    vista: "periodo",
    periodo: { atajo: preset, etiqueta: period.label },
    totales: {
      cuenta: vivas.length,
      totalCentavos: vivas.reduce((suma, c) => suma + c.totalCents, 0),
      pagadoCentavos: vivas.reduce((suma, c) => suma + c.paidCents, 0),
      saldoCentavos: vivas.reduce((suma, c) => suma + c.totalCents - c.paidCents, 0),
    },
    compras: compras.map((c) => ({
      id: c.id,
      numero: c.number,
      fecha: c.date.toISOString(),
      vence: c.dueDate?.toISOString() ?? null,
      descripcion: c.description,
      totalCentavos: c.totalCents,
      pagadoCentavos: c.paidCents,
      saldoCentavos: c.totalCents - c.paidCents,
      estado: c.status,
      vencida: Boolean(c.dueDate && c.dueDate < new Date() && c.status !== "PAID"),
      proveedor: c.supplier
        ? { id: c.supplier.id, nombre: c.supplier.name, telefono: c.supplier.phone }
        : null,
    })),
  };
});

export const POST = withUser(async ({ request }) => {
  const body = (await request.json()) as {
    descripcion?: string;
    totalCentavos?: number;
    pagadoCentavos?: number;
    proveedorId?: string | null;
    fecha?: string | null;
    vence?: string | null;
    notas?: string | null;
    metodo?: string;
  };

  const descripcion = body.descripcion?.trim() ?? "";
  const total = Math.round(body.totalCentavos ?? 0);
  if (!descripcion) throw new Error("Describe la compra.");
  if (total <= 0) throw new Error("El monto debe ser mayor que cero.");

  const pagado = Math.min(Math.max(0, Math.round(body.pagadoCentavos ?? 0)), total);

  const compra = await prisma.purchase.create({
    data: {
      number: await nextPurchaseNumber(),
      description: descripcion,
      totalCents: total,
      paidCents: pagado,
      status: purchaseStatusFor(total, pagado),
      supplierId: body.proveedorId || null,
      date: parseDay(body.fecha) ?? new Date(),
      dueDate: parseDay(body.vence),
      notes: body.notas?.trim() || null,
    },
  });

  if (pagado > 0) {
    await prisma.purchasePayment.create({
      data: {
        purchaseId: compra.id,
        amountCents: pagado,
        method: (body.metodo ?? "CASH_USD") as PaymentMethod,
      },
    });
  }

  return { id: compra.id, numero: compra.number };
});

export { OPTIONS } from "@/lib/api";

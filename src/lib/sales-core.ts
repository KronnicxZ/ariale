import "server-only";
import { prisma } from "@/lib/db";
import { getRate } from "@/lib/rate";
import { VES_METHODS } from "@/lib/money";
import type { PaymentMethod, PurchaseStatus, SaleStatus } from "@/generated/prisma/client";

/**
 * Reglas de caja compartidas por la web y por la API del móvil.
 *
 * Viven aquí y no en las acciones porque las acciones exigen la cookie de
 * sesión: la app entra con un token Bearer y necesita el mismo cálculo.
 */

/** Aviso pensado para la usuaria: se muestra tal cual, no se traduce. */
export class ErrorDeCaja extends Error {}

export function saleStatusFor(totalCents: number, paidCents: number): SaleStatus {
  if (paidCents <= 0) return "PENDING";
  if (paidCents >= totalCents) return "PAID";
  return "PARTIAL";
}

export function purchaseStatusFor(totalCents: number, paidCents: number): PurchaseStatus {
  if (paidCents <= 0) return "PENDING";
  if (paidCents >= totalCents) return "PAID";
  return "PARTIAL";
}

/** "2026-09-02" -> mediodía UTC, para que el día no se corra por zona horaria. */
export function parseDay(value: string | null | undefined) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** Numeración correlativa. SQLite no da autoincrement fuera del id. */
export async function nextSaleNumber() {
  const last = await prisma.sale.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

export async function nextPurchaseNumber() {
  const last = await prisma.purchase.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

export type SaleItemInput = {
  serviceId?: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  /** Bono del que se descuenta esta línea, si aplica. */
  clientPackageId?: string | null;
};

export type CreateSaleInput = {
  clientId: string;
  specialistId?: string | null;
  appointmentId?: string | null;
  items: SaleItemInput[];
  discountCents: number;
  date?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  payment?: { amountCents: number; method: PaymentMethod; reference?: string | null } | null;
  /** Bono nuevo que se vende en esta misma venta. */
  packageId?: string | null;
};

/**
 * Registra la venta completa: líneas, cobro inicial, consumo de bonos,
 * alta del bono vendido y cierre de la cita. Todo en una transacción.
 */
export async function createSaleRecord(input: CreateSaleInput) {
  if (!input.clientId) throw new ErrorDeCaja("Elige una clienta.");
  const items = input.items.filter((item) => item.description.trim());
  if (items.length === 0 && !input.packageId) throw new ErrorDeCaja("Agrega al menos un servicio.");

  const rateInfo = await getRate();

  // Las líneas cubiertas por un bono valen 0: ya se pagaron al comprarlo.
  const priced = items.map((item) => ({
    ...item,
    totalCents: item.clientPackageId ? 0 : item.unitPriceCents * item.quantity,
  }));

  let packageLine: (SaleItemInput & { totalCents: number }) | null = null;
  let pkg = null;
  if (input.packageId) {
    pkg = await prisma.package.findUnique({ where: { id: input.packageId } });
    if (pkg) {
      packageLine = {
        description: pkg.name,
        quantity: 1,
        unitPriceCents: pkg.priceCents,
        totalCents: pkg.priceCents,
      };
    }
  }

  const allLines = packageLine ? [...priced, packageLine] : priced;
  const subtotalCents = allLines.reduce((sum, item) => sum + item.totalCents, 0);
  const totalCents = Math.max(0, subtotalCents - input.discountCents);
  const paidCents = Math.min(input.payment?.amountCents ?? 0, totalCents);

  return prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        number: await nextSaleNumber(),
        date: parseDay(input.date) ?? new Date(),
        clientId: input.clientId,
        specialistId: input.specialistId || null,
        appointmentId: input.appointmentId || null,
        subtotalCents,
        discountCents: input.discountCents,
        totalCents,
        paidCents,
        status: saleStatusFor(totalCents, paidCents),
        dueDate: parseDay(input.dueDate),
        notes: input.notes || null,
        rateUsed: rateInfo.rate || null,
        items: {
          create: allLines.map((item) => ({
            serviceId: item.serviceId || null,
            description: item.description.trim(),
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            totalCents: item.totalCents,
            clientPackageId: item.clientPackageId || null,
          })),
        },
      },
    });

    if (input.payment && input.payment.amountCents > 0) {
      await tx.payment.create({
        data: {
          saleId: created.id,
          amountCents: paidCents,
          method: input.payment.method,
          reference: input.payment.reference || null,
          rateUsed: VES_METHODS.has(input.payment.method) ? rateInfo.rate || null : null,
        },
      });
    }

    // Consumo de sesiones de bono.
    const redemptions = new Map<string, number>();
    for (const item of priced) {
      if (!item.clientPackageId) continue;
      redemptions.set(
        item.clientPackageId,
        (redemptions.get(item.clientPackageId) ?? 0) + item.quantity,
      );
    }
    for (const [clientPackageId, count] of redemptions) {
      const current = await tx.clientPackage.findUnique({ where: { id: clientPackageId } });
      if (!current) continue;
      const used = Math.min(current.sessionsUsed + count, current.sessionsTotal);
      await tx.clientPackage.update({
        where: { id: clientPackageId },
        data: {
          sessionsUsed: used,
          status: used >= current.sessionsTotal ? "USED" : current.status,
        },
      });
    }

    // Alta del bono recién vendido.
    if (pkg) {
      await tx.clientPackage.create({
        data: {
          clientId: input.clientId,
          packageId: pkg.id,
          expiresAt: new Date(Date.now() + pkg.validityDays * 86_400_000),
          sessionsTotal: pkg.sessions,
          pricePaidCents: pkg.priceCents,
          saleId: created.id,
        },
      });
    }

    if (input.appointmentId) {
      await tx.appointment.update({
        where: { id: input.appointmentId },
        data: { status: "ATTENDED" },
      });
    }

    return created;
  });
}

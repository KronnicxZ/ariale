"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRate } from "@/lib/rate";
import { VES_METHODS } from "@/lib/money";
import {
  fail,
  ok,
  readCents,
  readInt,
  readOptional,
  readString,
  requireUser,
  toMessage,
  type ActionState,
} from "@/actions/shared";
import type { PaymentMethod, SaleStatus } from "@/generated/prisma/client";

function statusFor(totalCents: number, paidCents: number): SaleStatus {
  if (paidCents <= 0) return "PENDING";
  if (paidCents >= totalCents) return "PAID";
  return "PARTIAL";
}

function parseDay(value: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** Numeración correlativa. SQLite no da autoincrement fuera del id. */
async function nextSaleNumber() {
  const last = await prisma.sale.findFirst({
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

export async function createSaleAction(input: {
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
}): Promise<ActionState> {
  try {
    await requireUser();

    if (!input.clientId) return fail("Elige una clienta.");
    const items = input.items.filter((item) => item.description.trim());
    if (items.length === 0 && !input.packageId) return fail("Agrega al menos un servicio.");

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

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          number: await nextSaleNumber(),
          date: parseDay(input.date ?? null) ?? new Date(),
          clientId: input.clientId,
          specialistId: input.specialistId || null,
          appointmentId: input.appointmentId || null,
          subtotalCents,
          discountCents: input.discountCents,
          totalCents,
          paidCents,
          status: statusFor(totalCents, paidCents),
          dueDate: parseDay(input.dueDate ?? null),
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

    revalidatePath("/panel");
    revalidatePath("/panel/ventas");
    revalidatePath("/panel/cobrar");
    revalidatePath(`/panel/clientes/${input.clientId}`);
    return ok("Venta registrada.", sale.id);
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function addPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();

    const saleId = readString(formData, "saleId");
    const amountCents = readCents(formData, "amount");
    const method = (readString(formData, "method") || "CASH_USD") as PaymentMethod;

    if (amountCents <= 0) return fail("El monto debe ser mayor que cero.");

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: { totalCents: true, paidCents: true, clientId: true },
    });
    if (!sale) return fail("Esa venta ya no existe.");

    const balance = sale.totalCents - sale.paidCents;
    if (balance <= 0) return fail("Esa venta ya está cobrada por completo.");

    const applied = Math.min(amountCents, balance);
    const rateInfo = await getRate();
    const paidCents = sale.paidCents + applied;

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          saleId,
          amountCents: applied,
          method,
          reference: readOptional(formData, "reference"),
          rateUsed: VES_METHODS.has(method) ? rateInfo.rate || null : null,
        },
      }),
      prisma.sale.update({
        where: { id: saleId },
        data: { paidCents, status: statusFor(sale.totalCents, paidCents) },
      }),
    ]);

    revalidatePath("/panel");
    revalidatePath("/panel/ventas");
    revalidatePath(`/panel/ventas/${saleId}`);
    revalidatePath("/panel/cobrar");
    revalidatePath(`/panel/clientes/${sale.clientId}`);

    return ok(
      applied < amountCents
        ? `Se abonaron ${(applied / 100).toFixed(2)} USD: era lo que faltaba.`
        : "Pago registrado.",
    );
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function setSaleDueDateAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  await prisma.sale.update({
    where: { id },
    data: { dueDate: parseDay(readOptional(formData, "dueDate")) },
  });
  revalidatePath("/panel/cobrar");
  revalidatePath(`/panel/ventas/${id}`);
}

export async function cancelSaleAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  await prisma.sale.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/panel");
  revalidatePath("/panel/ventas");
  revalidatePath("/panel/cobrar");
}

export async function deleteSaleAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  await prisma.sale.delete({ where: { id } });
  revalidatePath("/panel/ventas");
  revalidatePath("/panel/cobrar");
  revalidatePath("/panel");
}

/** Cobro exprés desde la lista de cuentas por cobrar. */
export async function quickCollectAction(formData: FormData) {
  await requireUser();
  const saleId = readString(formData, "saleId");
  const percent = readInt(formData, "percent", 100);

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: { totalCents: true, paidCents: true },
  });
  if (!sale) return;

  const balance = sale.totalCents - sale.paidCents;
  if (balance <= 0) return;

  const applied = percent >= 100 ? balance : Math.round((balance * percent) / 100);
  const paidCents = sale.paidCents + applied;

  await prisma.$transaction([
    prisma.payment.create({ data: { saleId, amountCents: applied, method: "CASH_USD" } }),
    prisma.sale.update({
      where: { id: saleId },
      data: { paidCents, status: statusFor(sale.totalCents, paidCents) },
    }),
  ]);

  revalidatePath("/panel/cobrar");
  revalidatePath("/panel");
}

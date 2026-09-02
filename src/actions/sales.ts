"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getRate } from "@/lib/rate";
import { VES_METHODS } from "@/lib/money";
import {
  createSaleRecord,
  ErrorDeCaja,
  parseDay,
  saleStatusFor as statusFor,
  type CreateSaleInput,
} from "@/lib/sales-core";
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
import type { PaymentMethod } from "@/generated/prisma/client";

/**
 * El registro de la venta vive en `@/lib/sales-core` porque la app móvil
 * necesita exactamente el mismo cálculo y no puede pasar por las acciones,
 * que exigen la cookie de sesión.
 */
export async function createSaleAction(input: CreateSaleInput): Promise<ActionState> {
  try {
    await requireUser();
    const sale = await createSaleRecord(input);

    revalidatePath("/panel");
    revalidatePath("/panel/ventas");
    revalidatePath("/panel/cobrar");
    revalidatePath(`/panel/clientes/${input.clientId}`);
    return ok("Venta registrada.", sale.id);
  } catch (error) {
    // Los avisos de caja ya vienen escritos para la usuaria.
    if (error instanceof ErrorDeCaja) return fail(error.message);
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

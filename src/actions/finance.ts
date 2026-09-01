"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  fail,
  ok,
  readCents,
  readOptional,
  readString,
  requireUser,
  toMessage,
  type ActionState,
} from "@/actions/shared";
import type { PaymentMethod, PurchaseStatus } from "@/generated/prisma/client";

function parseDay(value: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function purchaseStatus(totalCents: number, paidCents: number): PurchaseStatus {
  if (paidCents <= 0) return "PENDING";
  if (paidCents >= totalCents) return "PAID";
  return "PARTIAL";
}

// --- Gastos ---------------------------------------------------------------

export async function saveExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();

    const id = readString(formData, "id");
    const description = readString(formData, "description");
    const amountCents = readCents(formData, "amount");

    if (!description) return fail("Describe el gasto.");
    if (amountCents <= 0) return fail("El monto debe ser mayor que cero.");

    const data = {
      description,
      amountCents,
      categoryId: readOptional(formData, "categoryId"),
      method: (readString(formData, "method") || "CASH_USD") as PaymentMethod,
      date: parseDay(readOptional(formData, "date")) ?? new Date(),
      userId: user.id,
    };

    const expense = id
      ? await prisma.expense.update({ where: { id }, data })
      : await prisma.expense.create({ data });

    revalidatePath("/panel");
    revalidatePath("/panel/gastos");
    return ok(id ? "Gasto actualizado." : "Gasto registrado.", expense.id);
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function deleteExpenseAction(formData: FormData) {
  await requireUser();
  await prisma.expense.delete({ where: { id: readString(formData, "id") } });
  revalidatePath("/panel");
  revalidatePath("/panel/gastos");
}

export async function saveExpenseCategoryAction(formData: FormData) {
  await requireUser();
  const name = readString(formData, "name");
  if (!name) return;
  await prisma.expenseCategory.upsert({
    where: { name },
    create: { name, color: readString(formData, "color") || "#E9B21C" },
    update: { color: readString(formData, "color") || "#E9B21C" },
  });
  revalidatePath("/panel/gastos");
}

// --- Proveedores ----------------------------------------------------------

export async function saveSupplierAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();

    const id = readString(formData, "id");
    const name = readString(formData, "name");
    if (name.length < 2) return fail("Escribe el nombre del proveedor.");

    const data = {
      name,
      phone: readOptional(formData, "phone"),
      email: readOptional(formData, "email"),
      notes: readOptional(formData, "notes"),
    };

    const supplier = id
      ? await prisma.supplier.update({ where: { id }, data })
      : await prisma.supplier.create({ data });

    revalidatePath("/panel/proveedores");
    return ok(id ? "Proveedor actualizado." : "Proveedor registrado.", supplier.id);
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function deleteSupplierAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const purchases = await prisma.purchase.count({ where: { supplierId: id } });
  if (purchases > 0) {
    await prisma.supplier.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.supplier.delete({ where: { id } });
  }
  revalidatePath("/panel/proveedores");
}

// --- Compras --------------------------------------------------------------

async function nextPurchaseNumber() {
  const last = await prisma.purchase.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

export async function savePurchaseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();

    const id = readString(formData, "id");
    const description = readString(formData, "description");
    const totalCents = readCents(formData, "total");
    const paidCents = Math.min(readCents(formData, "paid"), totalCents);

    if (!description) return fail("Describe la compra.");
    if (totalCents <= 0) return fail("El monto debe ser mayor que cero.");

    const data = {
      description,
      totalCents,
      supplierId: readOptional(formData, "supplierId"),
      date: parseDay(readOptional(formData, "date")) ?? new Date(),
      dueDate: parseDay(readOptional(formData, "dueDate")),
      notes: readOptional(formData, "notes"),
    };

    if (id) {
      await prisma.purchase.update({
        where: { id },
        data: { ...data, status: purchaseStatus(totalCents, paidCents) },
      });
      revalidatePath("/panel/compras");
      revalidatePath("/panel/pagar");
      return ok("Compra actualizada.", id);
    }

    const purchase = await prisma.purchase.create({
      data: {
        ...data,
        number: await nextPurchaseNumber(),
        paidCents,
        status: purchaseStatus(totalCents, paidCents),
      },
    });

    if (paidCents > 0) {
      await prisma.purchasePayment.create({
        data: {
          purchaseId: purchase.id,
          amountCents: paidCents,
          method: (readString(formData, "method") || "CASH_USD") as PaymentMethod,
        },
      });
    }

    revalidatePath("/panel");
    revalidatePath("/panel/compras");
    revalidatePath("/panel/pagar");
    return ok("Compra registrada.", purchase.id);
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function addPurchasePaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();

    const purchaseId = readString(formData, "purchaseId");
    const amountCents = readCents(formData, "amount");
    if (amountCents <= 0) return fail("El monto debe ser mayor que cero.");

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      select: { totalCents: true, paidCents: true },
    });
    if (!purchase) return fail("Esa compra ya no existe.");

    const balance = purchase.totalCents - purchase.paidCents;
    if (balance <= 0) return fail("Esa compra ya está pagada.");

    const applied = Math.min(amountCents, balance);
    const paidCents = purchase.paidCents + applied;

    await prisma.$transaction([
      prisma.purchasePayment.create({
        data: {
          purchaseId,
          amountCents: applied,
          method: (readString(formData, "method") || "CASH_USD") as PaymentMethod,
          reference: readOptional(formData, "reference"),
        },
      }),
      prisma.purchase.update({
        where: { id: purchaseId },
        data: { paidCents, status: purchaseStatus(purchase.totalCents, paidCents) },
      }),
    ]);

    revalidatePath("/panel");
    revalidatePath("/panel/compras");
    revalidatePath("/panel/pagar");
    return ok("Pago registrado.");
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function quickPayPurchaseAction(formData: FormData) {
  await requireUser();
  const purchaseId = readString(formData, "purchaseId");

  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    select: { totalCents: true, paidCents: true },
  });
  if (!purchase) return;

  const balance = purchase.totalCents - purchase.paidCents;
  if (balance <= 0) return;

  await prisma.$transaction([
    prisma.purchasePayment.create({
      data: { purchaseId, amountCents: balance, method: "TRANSFER" },
    }),
    prisma.purchase.update({
      where: { id: purchaseId },
      data: { paidCents: purchase.totalCents, status: "PAID" },
    }),
  ]);

  revalidatePath("/panel/pagar");
  revalidatePath("/panel/compras");
  revalidatePath("/panel");
}

export async function deletePurchaseAction(formData: FormData) {
  await requireUser();
  await prisma.purchase.delete({ where: { id: readString(formData, "id") } });
  revalidatePath("/panel/compras");
  revalidatePath("/panel/pagar");
  redirect("/panel/compras");
}

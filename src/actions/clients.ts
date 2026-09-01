"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/utils";
import {
  fail,
  ok,
  readOptional,
  readString,
  requireUser,
  toMessage,
  type ActionState,
} from "@/actions/shared";

function parseBirthday(value: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export async function saveClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();

    const id = readString(formData, "id");
    const name = readString(formData, "name");
    const phone = normalizePhone(readString(formData, "phone"));

    if (name.length < 2) return fail("Escribe el nombre de la clienta.");
    if (phone.length < 10) return fail("El teléfono debe tener al menos 10 dígitos.");

    const duplicate = await prisma.client.findFirst({
      where: { phone, ...(id ? { id: { not: id } } : {}) },
      select: { id: true, name: true },
    });
    if (duplicate) return fail(`Ese teléfono ya es de ${duplicate.name}.`);

    const data = {
      name,
      phone,
      email: readOptional(formData, "email"),
      instagram: readOptional(formData, "instagram")?.replace("@", "") ?? null,
      birthday: parseBirthday(readOptional(formData, "birthday")),
      notes: readOptional(formData, "notes"),
      allergies: readOptional(formData, "allergies"),
    };

    const client = id
      ? await prisma.client.update({ where: { id }, data })
      : await prisma.client.create({ data });

    revalidatePath("/panel/clientes");
    revalidatePath(`/panel/clientes/${client.id}`);
    return ok(id ? "Clienta actualizada." : "Clienta registrada.", client.id);
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function toggleClientActiveAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const client = await prisma.client.findUnique({ where: { id }, select: { active: true } });
  if (!client) return;

  await prisma.client.update({ where: { id }, data: { active: !client.active } });
  revalidatePath("/panel/clientes");
  revalidatePath(`/panel/clientes/${id}`);
}

export async function deleteClientAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");

  // Con historial no se borra: se desactiva, para no perder las ventas.
  const sales = await prisma.sale.count({ where: { clientId: id } });
  if (sales > 0) {
    await prisma.client.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.client.delete({ where: { id } });
  }

  revalidatePath("/panel/clientes");
  redirect("/panel/clientes");
}

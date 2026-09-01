"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentClient, setClientSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { fail, ok, readString, toMessage, type ActionState } from "@/actions/shared";

/**
 * La clienta se identifica solo con su teléfono. Si ya existe, entra directo;
 * si no, se le pide el nombre una vez y queda registrada.
 */
export async function clientIdentifyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const phone = normalizePhone(readString(formData, "phone"));
    const name = readString(formData, "name");

    if (phone.length < 10) return fail("Ese número no parece completo.");

    const existing = await prisma.client.findUnique({ where: { phone } });

    if (existing) {
      if (!existing.active) {
        await prisma.client.update({ where: { id: existing.id }, data: { active: true } });
      }
      await setClientSession(existing.id);
      revalidatePath("/reservar");
      return ok("Bienvenida de vuelta.");
    }

    if (!name) {
      // Primera vez: el formulario vuelve a pintarse pidiendo el nombre.
      return { error: "NEEDS_NAME" };
    }

    const client = await prisma.client.create({ data: { name, phone } });
    await setClientSession(client.id);
    revalidatePath("/reservar");
    revalidatePath("/panel/clientes");
    return ok("Cuenta creada.");
  } catch (error) {
    return fail(toMessage(error));
  }
}

/** La clienta cancela su propia cita. Solo si aún no ha pasado. */
export async function clientCancelAppointmentAction(formData: FormData) {
  const client = await getCurrentClient();
  if (!client) return;

  const id = readString(formData, "id");
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { clientId: true, startAt: true, status: true },
  });

  if (!appointment) return;
  if (appointment.clientId !== client.id) return;
  if (appointment.startAt < new Date()) return;
  if (appointment.status === "ATTENDED") return;

  await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED", cancelReason: "Cancelada por la clienta" },
  });

  revalidatePath("/reservar");
  revalidatePath("/panel/agenda");
  revalidatePath("/panel");
}

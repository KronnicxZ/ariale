"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { readOptional, readString, requireUser } from "@/actions/shared";
import type { ReminderKind } from "@/generated/prisma/client";

/** Marca un recordatorio como enviado para que no vuelva a aparecer. */
export async function markReminderAction(formData: FormData) {
  await requireUser();

  const kind = readString(formData, "kind") as ReminderKind;
  const clientId = readString(formData, "clientId");
  const appointmentId = readOptional(formData, "appointmentId");
  const note = readOptional(formData, "note");

  await prisma.reminderLog.create({
    data: { kind, clientId, appointmentId, note },
  });

  if (appointmentId) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { reminderSentAt: new Date() },
    });
  }

  revalidatePath("/panel/recordatorios");
  revalidatePath("/panel");
}

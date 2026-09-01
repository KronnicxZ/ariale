"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  clearSession,
  getCurrentUser,
  hashPassword,
  loginAdmin,
  loginSpecialist,
} from "@/lib/auth";

export type ActionState = { error?: string; success?: string } | null;

const loginSchema = z.object({
  email: z.string().email("Escribe un correo válido."),
  password: z.string().min(1, "Escribe tu contraseña."),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await loginAdmin(parsed.data.email, parsed.data.password);
  if (!user) return { error: "Correo o contraseña incorrectos." };

  redirect("/panel");
}

export async function logoutAction() {
  await clearSession("admin");
  redirect("/login");
}

export async function specialistLoginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const pin = String(formData.get("pin") ?? "");

  if (!/^\d{4}$/.test(pin)) return { error: "La clave son 4 dígitos." };

  const specialist = await loginSpecialist(slug, pin);
  if (!specialist) return { error: "Esa clave no es correcta." };

  redirect(`/agenda/${slug}`);
}

export async function specialistLogoutAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  await clearSession("specialist");
  redirect(slug ? `/agenda/${slug}` : "/");
}

export async function clientLogoutAction() {
  await clearSession("client");
  redirect("/reservar");
}

// --- Perfil ---------------------------------------------------------------

const profileSchema = z.object({
  name: z.string().min(2, "Escribe tu nombre."),
  email: z.string().email("Correo inválido."),
  phone: z.string().optional(),
});

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesión expirada." };

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const email = parsed.data.email.trim().toLowerCase();
  const taken = await prisma.user.findFirst({
    where: { email, id: { not: user.id } },
    select: { id: true },
  });
  if (taken) return { error: "Ese correo ya está en uso." };

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name.trim(), email, phone: parsed.data.phone?.trim() || null },
  });

  revalidatePath("/panel/perfil");
  return { success: "Perfil actualizado." };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Escribe tu contraseña actual."),
    next: z.string().min(8, "La nueva contraseña necesita al menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    message: "Las contraseñas nuevas no coinciden.",
  });

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesión expirada." };

  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (!(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { error: "La contraseña actual no es correcta." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.next) },
  });

  return { success: "Contraseña actualizada." };
}

import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Registra el token de este teléfono para recibir avisos push. Se llama
 * cada vez que la app abre sesión: si el token no cambió, es un simple
 * "sigo aquí"; si cambió (reinstaló, cambió de teléfono), reemplaza al
 * dueño anterior porque el token es único.
 */
export const POST = withUser(async ({ request, user }) => {
  const body = (await request.json()) as { token?: string };
  const token = body.token?.trim();
  if (!token) throw new Error("Falta el token del teléfono.");

  await prisma.deviceToken.upsert({
    where: { token },
    update: { userId: user.id },
    create: { token, userId: user.id },
  });

  return { guardado: true };
});

/** Al salir de la sesión, este teléfono deja de recibir avisos. */
export const DELETE = withUser(async ({ request }) => {
  const body = (await request.json()) as { token?: string };
  const token = body.token?.trim();
  if (!token) throw new Error("Falta el token del teléfono.");

  await prisma.deviceToken.deleteMany({ where: { token } });
  return { borrado: true };
});

export { OPTIONS } from "@/lib/api";

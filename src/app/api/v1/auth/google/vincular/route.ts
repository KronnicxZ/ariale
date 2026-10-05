import { prisma } from "@/lib/db";
import { ErrorGoogle, leerTokenDeGoogle } from "@/lib/google";
import { withUser } from "@/lib/api";

/**
 * Vincular y desvincular la cuenta de Google de quien está dentro.
 *
 * Pide sesión a propósito: vincular es decir "esta cuenta de Google soy yo",
 * y eso solo lo puede decir quien ya demostró ser ella con su contraseña.
 */
export const POST = withUser(async ({ request, user }) => {
  const body = (await request.json().catch(() => ({}))) as { idToken?: string };

  let cuenta;
  try {
    cuenta = await leerTokenDeGoogle(body.idToken ?? "");
  } catch (error) {
    throw new Error(error instanceof ErrorGoogle ? error.message : "No pudimos leer esa sesión.");
  }

  // Una cuenta de Google, una usuaria. Si no, dos personas entrarían al
  // mismo sitio creyendo cada una que es la suya.
  const otra = await prisma.user.findUnique({ where: { googleSub: cuenta.sub } });
  if (otra && otra.id !== user.id) {
    throw new Error(`Esa cuenta de Google ya es de ${otra.name}.`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { googleSub: cuenta.sub, googleEmail: cuenta.email },
  });

  return { google: { vinculada: true, correo: cuenta.email } };
});

export const DELETE = withUser(async ({ user }) => {
  await prisma.user.update({
    where: { id: user.id },
    // La contraseña sigue estando siempre, así que desvincular nunca deja a
    // nadie fuera de su propia cuenta.
    data: { googleSub: null, googleEmail: null },
  });

  return { google: { vinculada: false, correo: null } };
});

export { OPTIONS } from "@/lib/api";

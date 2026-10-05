import { prisma } from "@/lib/db";
import { issueApiToken } from "@/lib/api-auth";
import { ErrorGoogle, leerTokenDeGoogle } from "@/lib/google";
import { bad, ok } from "@/lib/api";

/**
 * Entrar con Google.
 *
 * Solo funciona si esa cuenta de Google ya está vinculada a una usuaria. No
 * se vincula sola por coincidir el correo: quien quiera entrar aquí tiene
 * que haber entrado antes con su contraseña y haberla vinculado a propósito.
 * Si no, bastaría con crear una cuenta de Google con el correo de otra para
 * abrir su panel.
 */
export async function POST(request: Request) {
  let body: { idToken?: string };
  try {
    body = await request.json();
  } catch {
    return bad("Cuerpo de la petición inválido.");
  }

  let cuenta;
  try {
    cuenta = await leerTokenDeGoogle(body.idToken ?? "");
  } catch (error) {
    return bad(error instanceof ErrorGoogle ? error.message : "No pudimos leer esa sesión.", 401);
  }

  const user = await prisma.user.findUnique({ where: { googleSub: cuenta.sub } });
  if (!user || !user.active) {
    return bad(
      "Esa cuenta de Google no está vinculada. Entra con tu contraseña y vincúlala desde Mi cuenta.",
      401,
    );
  }

  // Si cambió el correo de su Google, se guarda el nuevo: el vínculo es el
  // identificador, no el correo.
  if (user.googleEmail !== cuenta.email) {
    await prisma.user.update({ where: { id: user.id }, data: { googleEmail: cuenta.email } });
  }

  return ok({
    token: await issueApiToken(user.id),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      specialistId: user.specialistId,
    },
  });
}

export { OPTIONS } from "@/lib/api";

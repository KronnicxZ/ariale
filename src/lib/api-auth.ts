import "server-only";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Autenticación para la app móvil.
 *
 * La web usa una cookie httpOnly; la app Flutter no puede, así que manda el
 * mismo JWT en la cabecera `Authorization: Bearer …`. El secreto y el claim
 * `aud` son los mismos, de modo que hay una sola noción de sesión.
 */

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "ariale-studio-dev-secret-no-usar-en-produccion",
);

/** La sesión del móvil dura más: nadie quiere reloguearse en el salón. */
const MOBILE_MAX_AGE = 60 * 60 * 24 * 180;

export async function issueApiToken(userId: string) {
  return new SignJWT({ aud: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MOBILE_MAX_AGE}s`)
    .sign(secret);
}

export async function loginForApi(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user || !user.active) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;

  return { user, token: await issueApiToken(user.id) };
}

/** Devuelve la usuaria del token, o null si falta o no es válido. */
export async function getApiUser(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  try {
    const { payload } = await jwtVerify(header.slice(7).trim(), secret);
    if (payload.aud !== "admin" || typeof payload.sub !== "string") return null;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    return user?.active ? user : null;
  } catch {
    return null;
  }
}

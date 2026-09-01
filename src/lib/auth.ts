import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Tres puertas de entrada distintas, cada una con su cookie:
 *  - admin      → panel completo (correo + contraseña)
 *  - specialist → solo su agenda (PIN de 4 dígitos)
 *  - client     → solo sus citas (teléfono)
 */

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "ariale-studio-dev-secret-no-usar-en-produccion",
);

const COOKIE = {
  admin: "ariale_admin",
  specialist: "ariale_specialist",
  client: "ariale_client",
} as const;

type Audience = keyof typeof COOKIE;

const MAX_AGE: Record<Audience, number> = {
  admin: 60 * 60 * 24 * 30,
  specialist: 60 * 60 * 24 * 30,
  client: 60 * 60 * 24 * 180,
};

async function sign(aud: Audience, sub: string) {
  return new SignJWT({ aud })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE[aud]}s`)
    .sign(secret);
}

async function readToken(aud: Audience): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE[aud])?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.aud !== aud || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

async function setSession(aud: Audience, sub: string) {
  const store = await cookies();
  store.set(COOKIE[aud], await sign(aud, sub), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE[aud],
  });
}

export async function clearSession(aud: Audience) {
  const store = await cookies();
  store.delete(COOKIE[aud]);
}

// --- Administración -------------------------------------------------------

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function loginAdmin(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user || !user.active) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;
  await setSession("admin", user.id);
  return user;
}

export async function getCurrentUser() {
  const id = await readToken("admin");
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  return user?.active ? user : null;
}

// --- Especialista ---------------------------------------------------------

export async function loginSpecialist(slug: string, pin: string) {
  const specialist = await prisma.specialist.findUnique({ where: { slug } });
  if (!specialist || !specialist.active) return null;
  if (specialist.pin !== pin.trim()) return null;
  await setSession("specialist", specialist.id);
  return specialist;
}

export async function getCurrentSpecialist() {
  const id = await readToken("specialist");
  if (!id) return null;
  const specialist = await prisma.specialist.findUnique({ where: { id } });
  return specialist?.active ? specialist : null;
}

// --- Clienta --------------------------------------------------------------

export async function setClientSession(clientId: string) {
  await setSession("client", clientId);
}

export async function getCurrentClient() {
  const id = await readToken("client");
  if (!id) return null;
  const client = await prisma.client.findUnique({ where: { id } });
  return client?.active ? client : null;
}

/**
 * Imprime una cookie de sesión válida para probar el panel sin pasar por el
 * formulario de login. Solo para desarrollo local.
 *
 *   node scripts/dev-token.mjs            -> sesión de administradora
 *   node scripts/dev-token.mjs specialist -> sesión de la primera especialista
 */
import { SignJWT } from "jose";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client.js";

process.loadEnvFile(".env");

const audience = process.argv[2] === "specialist" ? "specialist" : "admin";
const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL }),
});

const subject =
  audience === "admin"
    ? (await prisma.user.findFirst())?.id
    : (await prisma.specialist.findFirst())?.id;

if (!subject) {
  console.error("No hay registros. Corre `npm run seed` primero.");
  process.exit(1);
}

const token = await new SignJWT({ aud: audience })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(subject)
  .setIssuedAt()
  .setExpirationTime("30d")
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET));

console.log(`ariale_${audience}=${token}`);
await prisma.$disconnect();

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma";

// Para pasar a Postgres (Neon/Supabase) en producción:
//   1. cambia `provider = "postgresql"` en prisma/schema.prisma
//   2. sustituye este adaptador por `new PrismaPg({ connectionString })`
//      de @prisma/adapter-pg
//   3. npx prisma migrate deploy
const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

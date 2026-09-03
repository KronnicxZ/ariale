import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 ya no lee .env por su cuenta.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // En Vercel las variables ya vienen del entorno.
}

// El CLI (db push, migrate) no sabe de authToken por separado como el
// adaptador en tiempo de ejecución (src/lib/db.ts): a Turso hay que
// dárselo pegado a la URL.
const dbUrl =
  process.env.DATABASE_URL?.startsWith("libsql:") && process.env.DATABASE_AUTH_TOKEN
    ? `${process.env.DATABASE_URL}?authToken=${process.env.DATABASE_AUTH_TOKEN}`
    : process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: dbUrl,
  },
});

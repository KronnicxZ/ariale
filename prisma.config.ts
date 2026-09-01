import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 ya no lee .env por su cuenta.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // En Vercel las variables ya vienen del entorno.
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * Configuración del salón. Se cachea por request para que las decenas de
 * componentes que necesitan el nombre, la zona horaria o los colores no
 * disparen una consulta cada uno.
 */
export const getSettings = cache(async () => {
  const settings = await prisma.settings.findFirst();
  if (settings) return settings;

  return prisma.settings.create({
    data: { id: 1 },
  });
});

export const getWorkingHours = cache(async () => {
  const hours = await prisma.workingHour.findMany({ orderBy: { dayOfWeek: "asc" } });
  if (hours.length === 7) return hours;

  const existing = new Set(hours.map((h) => h.dayOfWeek));
  const missing = [0, 1, 2, 3, 4, 5, 6].filter((d) => !existing.has(d));
  if (missing.length) {
    await prisma.workingHour.createMany({
      data: missing.map((dayOfWeek) => ({ dayOfWeek, enabled: dayOfWeek !== 0 })),
    });
  }
  return prisma.workingHour.findMany({ orderBy: { dayOfWeek: "asc" } });
});

export type Settings = Awaited<ReturnType<typeof getSettings>>;

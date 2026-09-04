import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * La última versión publicada de la app.
 *
 * La app pregunta esto al abrir y compara `build` con el suyo. Si el de
 * aquí es mayor, se ofrece a bajar el APK e instalarlo. Devuelve `null`
 * mientras no se haya publicado ninguna, que es lo normal el primer día.
 */
export const GET = withUser(async () => {
  const ultima = await prisma.appRelease.findFirst({
    orderBy: { buildNumber: "desc" },
    select: { version: true, buildNumber: true, url: true, notes: true, createdAt: true },
  });

  if (!ultima) return { version: null };

  return {
    version: {
      nombre: ultima.version,
      build: ultima.buildNumber,
      url: ultima.url,
      notas: ultima.notes,
      publicada: ultima.createdAt.toISOString(),
    },
  };
});

export { OPTIONS } from "@/lib/api";

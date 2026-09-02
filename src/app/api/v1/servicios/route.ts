import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { HairRemovalMethod } from "@/generated/prisma/client";

/**
 * El catálogo editable, incluidos los servicios apagados.
 * `/catalogo` solo trae los activos porque es lo que se agenda.
 */
export const GET = withUser(async () => {
  const [servicios, categorias] = await Promise.all([
    prisma.service.findMany({
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }, { name: "asc" }],
      include: { category: { select: { id: true, name: true, color: true, kind: true } } },
    }),
    prisma.category.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, kind: true, color: true, active: true },
    }),
  ]);

  return {
    categorias: categorias.map((c) => ({
      id: c.id,
      nombre: c.name,
      tipo: c.kind,
      color: c.color,
      activa: c.active,
    })),
    servicios: servicios.map((s) => ({
      id: s.id,
      nombre: s.name,
      descripcion: s.description,
      precioCentavos: s.priceCents,
      duracionMin: s.durationMin,
      activo: s.active,
      zona: s.bodyZone,
      metodo: s.method,
      cicloDias: s.sessionIntervalDays,
      requierePrueba: s.requiresPatchTest,
      categoria: {
        id: s.category.id,
        nombre: s.category.name,
        color: s.category.color,
        tipo: s.category.kind,
      },
    })),
  };
});

/** Crea o edita un servicio. Sin `id` lo crea. */
export const POST = withUser(async ({ request }) => {
  const body = (await request.json()) as {
    id?: string;
    nombre?: string;
    descripcion?: string | null;
    precioCentavos?: number;
    duracionMin?: number;
    categoriaId?: string;
    activo?: boolean;
    zona?: string | null;
    metodo?: string;
    cicloDias?: number | null;
    requierePrueba?: boolean;
  };

  const nombre = body.nombre?.trim() ?? "";
  const duracion = Math.round(body.duracionMin ?? 60);

  if (nombre.length < 2) throw new Error("Escribe el nombre del servicio.");
  if (!body.categoriaId) throw new Error("Elige una categoría.");
  if (duracion < 5) throw new Error("La duración mínima es de 5 minutos.");

  const ciclo = Math.round(body.cicloDias ?? 0);

  const datos = {
    name: nombre,
    description: body.descripcion?.trim() || null,
    priceCents: Math.max(0, Math.round(body.precioCentavos ?? 0)),
    durationMin: duracion,
    categoryId: body.categoriaId,
    active: body.activo ?? true,
    bodyZone: body.zona?.trim() || null,
    method: (body.metodo ?? "NONE") as HairRemovalMethod,
    sessionIntervalDays: ciclo > 0 ? ciclo : null,
    requiresPatchTest: body.requierePrueba ?? false,
  };

  const servicio = body.id
    ? await prisma.service.update({ where: { id: body.id }, data: datos })
    : await prisma.service.create({ data: datos });

  return { id: servicio.id };
});

/** Enciende o apaga un servicio sin tocar el resto de su ficha. */
export const PATCH = withUser(async ({ request }) => {
  const body = (await request.json()) as { id?: string; activo?: boolean };
  if (!body.id) throw new Error("Falta el servicio.");

  const servicio = await prisma.service.findUnique({
    where: { id: body.id },
    select: { active: true },
  });
  if (!servicio) throw new Error("Ese servicio ya no existe.");

  const activo = body.activo ?? !servicio.active;
  await prisma.service.update({ where: { id: body.id }, data: { active: activo } });
  return { id: body.id, activo };
});

export { OPTIONS } from "@/lib/api";

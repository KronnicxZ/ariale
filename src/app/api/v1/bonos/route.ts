import { param, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Los bonos del estudio y cuántos hay vendidos y vivos.
 * Un bono son sesiones pagadas por adelantado, casi siempre de depilación.
 */
export const GET = withUser(async () => {
  const bonos = await prisma.package.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      services: { select: { serviceId: true } },
      sold: { select: { status: true, sessionsTotal: true, sessionsUsed: true } },
    },
  });

  return {
    bonos: bonos.map((b) => {
      const vivos = b.sold.filter((s) => s.status === "ACTIVE");
      return {
        id: b.id,
        nombre: b.name,
        descripcion: b.description,
        sesiones: b.sessions,
        precioCentavos: b.priceCents,
        validezDias: b.validityDays,
        activo: b.active,
        servicioIds: b.services.map((s) => s.serviceId),
        vendidos: b.sold.length,
        activos: vivos.length,
        sesionesPendientes: vivos.reduce(
          (suma, s) => suma + Math.max(0, s.sessionsTotal - s.sessionsUsed),
          0,
        ),
      };
    }),
  };
});

/** Crea o edita un bono y los servicios que cubre. */
export const POST = withUser(async ({ request }) => {
  const body = (await request.json()) as {
    id?: string;
    nombre?: string;
    descripcion?: string | null;
    sesiones?: number;
    precioCentavos?: number;
    validezDias?: number;
    activo?: boolean;
    servicioIds?: string[];
  };

  const nombre = body.nombre?.trim() ?? "";
  const sesiones = Math.round(body.sesiones ?? 6);
  const servicioIds = body.servicioIds ?? [];

  if (nombre.length < 2) throw new Error("Escribe el nombre del bono.");
  if (sesiones < 2) throw new Error("Un bono necesita al menos 2 sesiones.");
  if (servicioIds.length === 0) throw new Error("Elige qué servicios cubre el bono.");

  const datos = {
    name: nombre,
    description: body.descripcion?.trim() || null,
    sessions: sesiones,
    priceCents: Math.max(0, Math.round(body.precioCentavos ?? 0)),
    validityDays: Math.round(body.validezDias ?? 365),
    active: body.activo ?? true,
  };

  if (body.id) {
    const id = body.id;
    await prisma.$transaction([
      prisma.package.update({ where: { id }, data: datos }),
      prisma.packageService.deleteMany({ where: { packageId: id } }),
      prisma.packageService.createMany({
        data: servicioIds.map((serviceId) => ({ packageId: id, serviceId })),
      }),
    ]);
    return { id };
  }

  const bono = await prisma.package.create({
    data: { ...datos, services: { create: servicioIds.map((serviceId) => ({ serviceId })) } },
  });

  return { id: bono.id };
});

/**
 * Borra un bono.
 *
 * Solo si no se ha vendido ninguno. Si alguna clienta lo compró, borrarlo
 * dejaría sus sesiones pendientes colgando de la nada: entonces se apaga,
 * que impide venderlo más pero respeta las que ya están en la calle.
 */
export const DELETE = withUser(async ({ request }) => {
  const id = param(request, "id");
  const conVendidos = param(request, "conVendidos") === "1";
  if (!id) throw new Error("Falta el bono.");

  const bono = await prisma.package.findUnique({
    where: { id },
    select: { name: true, _count: { select: { sold: true } } },
  });
  if (!bono) throw new Error("Ese bono ya no existe.");

  const vendidos = bono._count.sold;

  if (vendidos > 0 && !conVendidos) {
    await prisma.package.update({ where: { id }, data: { active: false } });
    return {
      id,
      borrado: false,
      vendidos,
      mensaje: `${bono.name} ya se vendió ${vendidos} ${
        vendidos === 1 ? "vez" : "veces"
      }. No se puede borrar sin perder esas sesiones, así que lo apagamos.`,
    };
  }

  if (vendidos > 0) {
    await prisma.$transaction([
      prisma.clientPackage.deleteMany({ where: { packageId: id } }),
      prisma.package.delete({ where: { id } }),
    ]);
    return {
      id,
      borrado: true,
      vendidos,
      mensaje: `${bono.name} y las ${vendidos} ${
        vendidos === 1 ? "venta" : "ventas"
      } que tenía se borraron.`,
    };
  }

  await prisma.package.delete({ where: { id } });
  return { id, borrado: true, vendidos: 0 };
});

export { OPTIONS } from "@/lib/api";

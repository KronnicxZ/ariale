import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getBookingOptions } from "@/data/booking";
import { getRate } from "@/lib/rate";
import { getWorkingHours } from "@/lib/settings";

/**
 * Todo lo que la app necesita para funcionar sin volver a preguntar:
 * servicios, especialistas, bonos, horario, ajustes y tasa del día.
 * La app lo guarda en local y lo refresca al abrir.
 */
export const GET = withUser(async () => {
  const [{ settings, services, specialists, today, maxDay }, packages, hours, rate] =
    await Promise.all([
      getBookingOptions(),
      prisma.package.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        include: { services: { select: { serviceId: true } } },
      }),
      getWorkingHours(),
      getRate(),
    ]);

  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    select: { id: true, name: true, kind: true, color: true, order: true },
  });

  return {
    hoy: today,
    maxDia: maxDay,
    negocio: {
      nombre: settings.businessName,
      lema: settings.tagline,
      logoUrl: settings.logoUrl,
      telefono: settings.phone,
      whatsapp: settings.whatsapp,
      instagram: settings.instagram,
      direccion: settings.address,
      zonaHoraria: settings.timezone,
      prefijo: settings.countryCode,
      intervaloMin: settings.slotMinutes,
      confirmarAuto: settings.autoConfirm,
      diasMaximo: settings.maxDaysAhead,
      horasMinimas: settings.minHoursAhead,
      colorAcento: settings.accentColor,
      colorMenu: settings.menuColor,
    },
    tasa: { valor: rate.rate, fuente: rate.source, desactualizada: rate.stale },
    horario: hours.map((h) => ({
      dia: h.dayOfWeek,
      abierto: h.enabled,
      desde: h.openTime,
      hasta: h.closeTime,
    })),
    categorias: categories.map((c) => ({
      id: c.id,
      nombre: c.name,
      tipo: c.kind,
      color: c.color,
      orden: c.order,
    })),
    servicios: services.map((s) => ({
      id: s.id,
      nombre: s.name,
      descripcion: s.description,
      precioCentavos: s.priceCents,
      duracionMin: s.durationMin,
      zona: s.bodyZone,
      requierePrueba: s.requiresPatchTest,
      categoriaId: s.categoryId,
      categoriaNombre: s.categoryName,
      categoriaColor: s.categoryColor,
    })),
    especialistas: specialists.map((s) => ({
      id: s.id,
      nombre: s.name,
      color: s.color,
      servicioIds: s.serviceIds,
    })),
    bonos: packages.map((p) => ({
      id: p.id,
      nombre: p.name,
      descripcion: p.description,
      sesiones: p.sessions,
      precioCentavos: p.priceCents,
      validezDias: p.validityDays,
      servicioIds: p.services.map((s) => s.serviceId),
    })),
  };
});

export { OPTIONS } from "@/lib/api";

import "server-only";
import { prisma } from "@/lib/db";
import { dayKey } from "@/lib/date";
import { getSettings } from "@/lib/settings";
import type { PackageBalance, ServiceOption, SpecialistOption } from "@/components/booking/types";

/** Todo lo que el asistente de reserva necesita para dibujarse. */
export async function getBookingOptions() {
  const settings = await getSettings();

  const [services, specialists] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }, { name: "asc" }],
      include: {
        category: { select: { id: true, name: true, color: true, kind: true, order: true } },
      },
    }),
    prisma.specialist.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { skills: { select: { serviceId: true } } },
    }),
  ]);

  const serviceOptions: ServiceOption[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    priceCents: service.priceCents,
    durationMin: service.durationMin,
    bodyZone: service.bodyZone,
    requiresPatchTest: service.requiresPatchTest,
    categoryId: service.category.id,
    categoryName: service.category.name,
    categoryColor: service.category.color,
    categoryKind: service.category.kind,
  }));

  const specialistOptions: SpecialistOption[] = specialists.map((specialist) => ({
    id: specialist.id,
    name: specialist.name,
    color: specialist.color,
    // Sin habilidades declaradas asumimos que hace de todo, para no dejar
    // la agenda vacía si nadie configuró el catálogo por persona.
    serviceIds:
      specialist.skills.length > 0
        ? specialist.skills.map((s) => s.serviceId)
        : serviceOptions.map((s) => s.id),
  }));

  const today = dayKey(new Date(), settings.timezone);
  const maxDate = new Date(Date.now() + settings.maxDaysAhead * 86_400_000);

  return {
    settings,
    services: serviceOptions,
    specialists: specialistOptions,
    today,
    maxDay: dayKey(maxDate, settings.timezone),
  };
}

/** Bonos con saldo disponible de una clienta. */
export async function getClientPackages(clientId: string): Promise<PackageBalance[]> {
  const packages = await prisma.clientPackage.findMany({
    where: { clientId, status: "ACTIVE", expiresAt: { gte: new Date() } },
    include: { package: { include: { services: { select: { serviceId: true } } } } },
    orderBy: { expiresAt: "asc" },
  });

  return packages
    .map((entry) => ({
      id: entry.id,
      name: entry.package.name,
      remaining: entry.sessionsTotal - entry.sessionsUsed,
      serviceIds: entry.package.services.map((s) => s.serviceId),
    }))
    .filter((entry) => entry.remaining > 0);
}

/** Listado ligero de clientas para los buscadores del panel y la agenda. */
export async function getClientOptions(limit = 500) {
  return prisma.client.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true, phone: true },
  });
}

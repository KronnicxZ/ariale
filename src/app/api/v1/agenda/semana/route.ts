import { param, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { addDays, dayKey, endOfDayUtc, startOfDayUtc } from "@/lib/date";

/**
 * La semana entera de un vistazo, para la app.
 *
 * En la agenda por día hay que ir tocando día por día para saber cuándo hay
 * un rato libre. Esto devuelve los siete días de golpe y en corto: lo justo
 * para pintar los bloques —cuándo empieza, cuánto dura, de quién es y de
 * quién viene—. El detalle se pide al tocar la cita.
 */
export const GET = withUser(async ({ request }) => {
  const settings = await getSettings();
  const tz = settings.timezone;

  const desde = param(request, "desde") ?? dayKey(new Date(), tz);
  const cuantos = Number(param(request, "dias") ?? 7);
  const dias = Number.isFinite(cuantos) && cuantos > 0 && cuantos <= 14 ? cuantos : 7;

  const inicio = startOfDayUtc(desde, tz);
  const ultimo = dayKey(addDays(inicio, dias - 1), tz);
  const fin = endOfDayUtc(ultimo, tz);

  const [citas, especialistas] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startAt: { gte: inicio, lte: fin },
        // Lo cancelado y los plantones no ocupan sitio: en una rejilla de
        // siete días solo estorban.
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        specialistId: true,
        client: { select: { name: true } },
        services: { select: { service: { select: { name: true } } } },
      },
    }),
    prisma.specialist.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  return {
    desde,
    hasta: ultimo,
    especialistas: especialistas.map((e) => ({
      id: e.id,
      nombre: e.name,
      color: e.color,
    })),
    citas: citas.map((c) => ({
      id: c.id,
      dia: dayKey(c.startAt, tz),
      inicio: c.startAt.toISOString(),
      fin: c.endAt.toISOString(),
      estado: c.status,
      especialistaId: c.specialistId,
      clienta: c.client.name,
      servicios: c.services.map((s) => s.service.name).join(" + "),
    })),
  };
});

export { OPTIONS } from "@/lib/api";

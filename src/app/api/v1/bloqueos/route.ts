import { param, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { addDays, dayKey, endOfDayUtc, startOfDayUtc, tzDateTimeToUtc } from "@/lib/date";

/**
 * Los ratos en que alguien no atiende: un día libre, una tarde de médico, una
 * semana de viaje.
 *
 * No es una función nueva del cálculo de huecos —`getAvailability` y
 * `getDiasConHueco` ya los respetan desde siempre— sino la forma de crearlos
 * sin entrar a la base. Al guardarlos, esas horas dejan de ofrecerse en la
 * página al momento, sin desplegar nada.
 */
export const GET = withUser(async () => {
  const settings = await getSettings();
  const desdeAyer = addDays(new Date(), -1);

  const bloqueos = await prisma.timeOff.findMany({
    where: { endAt: { gte: desdeAyer } },
    orderBy: { startAt: "asc" },
    include: { specialist: { select: { id: true, name: true, color: true } } },
  });

  return {
    bloqueos: bloqueos.map((b) => ({
      id: b.id,
      especialista: {
        id: b.specialist.id,
        nombre: b.specialist.name,
        color: b.specialist.color,
      },
      inicio: b.startAt.toISOString(),
      fin: b.endAt.toISOString(),
      dia: dayKey(b.startAt, settings.timezone),
      diaFin: dayKey(b.endAt, settings.timezone),
      motivo: b.reason,
    })),
  };
});

/**
 * Crea el bloqueo. Sin horas es el día entero; con horas, ese rato de cada
 * día del tramo —una fila por día y por persona, para que el cálculo de
 * huecos no tenga que entender rangos raros.
 */
export const POST = withUser(async ({ request }) => {
  const body = (await request.json()) as {
    especialistaIds?: string[];
    desde?: string;
    hasta?: string;
    horaDesde?: string | null;
    horaHasta?: string | null;
    motivo?: string | null;
  };

  const settings = await getSettings();
  const tz = settings.timezone;
  const quienes = body.especialistaIds ?? [];
  const desde = body.desde ?? "";
  const hasta = body.hasta || desde;

  if (quienes.length === 0) throw new Error("Elige de quién es el bloqueo.");
  if (!desde) throw new Error("Elige el día.");
  if (hasta < desde) throw new Error("El día final no puede ser antes del inicial.");

  const porHoras = Boolean(body.horaDesde && body.horaHasta);
  if (porHoras && body.horaHasta! <= body.horaDesde!) {
    throw new Error("La hora final tiene que ser después de la inicial.");
  }

  const motivo = body.motivo?.trim() || null;
  const filas: { specialistId: string; startAt: Date; endAt: Date; reason: string | null }[] = [];

  for (const specialistId of quienes) {
    if (!porHoras) {
      // Todo el tramo de una sola fila: es un rato continuo de verdad.
      filas.push({
        specialistId,
        startAt: startOfDayUtc(desde, tz),
        endAt: endOfDayUtc(hasta, tz),
        reason: motivo,
      });
      continue;
    }

    // Un rato de cada día: una fila por día, o el bloqueo taparía también
    // las noches y las mañanas de en medio.
    for (let dia = desde; dia <= hasta; dia = dayKey(addDays(startOfDayUtc(dia, tz), 1), tz)) {
      filas.push({
        specialistId,
        startAt: tzDateTimeToUtc(dia, body.horaDesde!, tz),
        endAt: tzDateTimeToUtc(dia, body.horaHasta!, tz),
        reason: motivo,
      });
    }
  }

  await prisma.timeOff.createMany({ data: filas });
  return { creados: filas.length };
});

export const DELETE = withUser(async ({ request }) => {
  const id = param(request, "id");
  if (!id) throw new Error("Falta el bloqueo.");
  await prisma.timeOff.delete({ where: { id } });
  return { borrado: true };
});

export { OPTIONS } from "@/lib/api";

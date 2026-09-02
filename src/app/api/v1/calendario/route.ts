import { param, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { dayKey, endOfDayUtc, startOfDayUtc } from "@/lib/date";
import { getSettings } from "@/lib/settings";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Suma un número de días a "2026-09-02" sin salir del calendario. */
function sumarDias(dia: string, dias: number) {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/**
 * Cuántas citas tiene cada día de un rango. Lo consume el calendario de la
 * app para pintar el mes de un tirón, sin una petición por día.
 */
export const GET = withUser(async ({ request }) => {
  const settings = await getSettings();
  const hoy = dayKey(new Date(), settings.timezone);

  const desde = param(request, "desde") ?? hoy;
  if (!ISO_DAY.test(desde)) throw new Error("La fecha de inicio no es válida.");

  const hasta = param(request, "hasta") ?? sumarDias(desde, 41);
  if (!ISO_DAY.test(hasta)) throw new Error("La fecha de fin no es válida.");
  if (hasta < desde) throw new Error("El rango está al revés.");

  const citas = await prisma.appointment.findMany({
    where: {
      startAt: {
        gte: startOfDayUtc(desde, settings.timezone),
        lte: endOfDayUtc(hasta, settings.timezone),
      },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { startAt: true, status: true, specialistId: true },
  });

  const porDia = new Map<
    string,
    { citas: number; porConfirmar: number; especialistas: Set<string> }
  >();

  for (const cita of citas) {
    const clave = dayKey(cita.startAt, settings.timezone);
    const actual = porDia.get(clave) ?? {
      citas: 0,
      porConfirmar: 0,
      especialistas: new Set<string>(),
    };
    actual.citas += 1;
    if (cita.status === "PENDING") actual.porConfirmar += 1;
    actual.especialistas.add(cita.specialistId);
    porDia.set(clave, actual);
  }

  return {
    hoy,
    desde,
    hasta,
    dias: [...porDia.entries()]
      .map(([dia, datos]) => ({
        dia,
        citas: datos.citas,
        porConfirmar: datos.porConfirmar,
        especialistas: datos.especialistas.size,
      }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
  };
});

export { OPTIONS } from "@/lib/api";

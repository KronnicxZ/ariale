import { param, withUser } from "@/lib/api";
import { getDayAgenda, getWeekStrip } from "@/data/agenda";
import { getSettings } from "@/lib/settings";
import { dayKey } from "@/lib/date";
import { serializeAppointment } from "@/lib/api-serializers";
import type { AppointmentStatus } from "@/generated/prisma/client";

const STATUSES = new Set(["PENDING", "CONFIRMED", "ATTENDED", "CANCELLED", "NO_SHOW"]);

/** Agenda de un día, con los mismos filtros que la web. */
export const GET = withUser(async ({ request }) => {
  const settings = await getSettings();
  const today = dayKey(new Date(), settings.timezone);
  const day = param(request, "dia") ?? today;
  const specialistId = param(request, "especialista");
  const rawStatus = param(request, "estado");
  const status =
    rawStatus && STATUSES.has(rawStatus) ? (rawStatus as AppointmentStatus) : undefined;

  const [agenda, strip] = await Promise.all([
    getDayAgenda({ day, specialistId, status, tz: settings.timezone }),
    getWeekStrip(day, settings.timezone),
  ]);

  return {
    dia: day,
    hoy: today,
    citas: agenda.appointments.map(serializeAppointment),
    contadores: {
      total: agenda.counts.total,
      porConfirmar: agenda.counts.pending,
      confirmadas: agenda.counts.confirmed,
      atendidas: agenda.counts.attended,
      canceladas: agenda.counts.cancelled,
    },
    previstoCentavos: agenda.revenueCents,
    especialistas: agenda.specialists.map((s) => ({
      id: s.id,
      nombre: s.name,
      color: s.color,
    })),
    semana: strip.map((d) => ({
      dia: d.day,
      diaSemana: d.dayOfWeek,
      numero: d.dayNumber,
      mes: d.month,
      citas: d.count,
    })),
  };
});

export { OPTIONS } from "@/lib/api";

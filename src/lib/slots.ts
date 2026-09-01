import "server-only";
import { prisma } from "@/lib/db";
import { TZ, addDays, addMinutes, dayKey, endOfDayUtc, startOfDayUtc, toTz, tzDateTimeToUtc } from "@/lib/date";

/**
 * Cálculo de huecos libres.
 *
 * Un hueco sirve si: el salón está abierto ese día, cabe la duración completa
 * antes del cierre, no pisa otra cita del mismo especialista, no cae en un
 * bloqueo de agenda y no está en el pasado inmediato.
 */

export type Slot = {
  /** "14:30" en hora del salón */
  time: string;
  /** instante UTC de inicio */
  startAt: Date;
  period: "morning" | "afternoon" | "evening";
};

export type DayAvailability = {
  day: string;
  open: boolean;
  slots: Slot[];
  reason?: string;
};

function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function timeOf(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function periodOf(minutes: number): Slot["period"] {
  if (minutes < 12 * 60) return "morning";
  if (minutes < 18 * 60) return "afternoon";
  return "evening";
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export async function getAvailability(options: {
  day: string;
  durationMin: number;
  specialistId?: string | null;
  /** Al reprogramar, la cita que se está moviendo no debe bloquearse a sí misma. */
  excludeAppointmentId?: string;
}): Promise<DayAvailability> {
  const { day, durationMin, specialistId, excludeAppointmentId } = options;

  const [settings, workingHours] = await Promise.all([
    prisma.settings.findFirst(),
    prisma.workingHour.findMany(),
  ]);
  const tz = settings?.timezone ?? TZ;
  const slotMinutes = settings?.slotMinutes ?? 30;
  const minHoursAhead = settings?.minHoursAhead ?? 1;

  const dayStart = startOfDayUtc(day, tz);
  const dayEnd = endOfDayUtc(day, tz);
  const dow = toTz(dayStart, tz).getDay();

  const hours = workingHours.find((h) => h.dayOfWeek === dow);
  if (!hours || !hours.enabled) {
    return { day, open: false, slots: [], reason: "El salón no atiende ese día." };
  }

  const openMin = minutesOf(hours.openTime);
  const closeMin = minutesOf(hours.closeTime);
  if (closeMin - openMin < durationMin) {
    return { day, open: true, slots: [], reason: "La jornada es más corta que el servicio." };
  }

  const [appointments, timeOff] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        ...(specialistId ? { specialistId } : {}),
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { startAt: true, endAt: true, specialistId: true },
    }),
    prisma.timeOff.findMany({
      where: {
        startAt: { lte: dayEnd },
        endAt: { gte: dayStart },
        ...(specialistId ? { specialistId } : {}),
      },
      select: { startAt: true, endAt: true, specialistId: true },
    }),
  ]);

  // Sin especialista fijo, la disponibilidad es la del equipo completo:
  // un hueco existe mientras quede al menos una persona libre.
  const specialists = specialistId
    ? [{ id: specialistId }]
    : await prisma.specialist.findMany({ where: { active: true }, select: { id: true } });

  if (specialists.length === 0) {
    return { day, open: true, slots: [], reason: "No hay especialistas activas." };
  }

  const toMin = (date: Date) => {
    const local = toTz(date, tz);
    return local.getHours() * 60 + local.getMinutes();
  };

  const busyBySpecialist = new Map<string, [number, number][]>();
  for (const s of specialists) busyBySpecialist.set(s.id, []);
  for (const appt of appointments) {
    const list = busyBySpecialist.get(appt.specialistId);
    if (list) list.push([toMin(appt.startAt), toMin(appt.endAt)]);
  }
  for (const off of timeOff) {
    const list = busyBySpecialist.get(off.specialistId);
    if (!list) continue;
    const s = off.startAt < dayStart ? 0 : toMin(off.startAt);
    const e = off.endAt > dayEnd ? 24 * 60 : toMin(off.endAt);
    list.push([s, e]);
  }

  const earliest = addMinutes(new Date(), minHoursAhead * 60);
  const slots: Slot[] = [];

  for (let start = openMin; start + durationMin <= closeMin; start += slotMinutes) {
    const end = start + durationMin;
    const someoneFree = specialists.some((s) =>
      (busyBySpecialist.get(s.id) ?? []).every(([bs, be]) => !overlaps(start, end, bs, be)),
    );
    if (!someoneFree) continue;

    const startAt = tzDateTimeToUtc(day, timeOf(start), tz);
    if (startAt < earliest) continue;

    slots.push({ time: timeOf(start), startAt, period: periodOf(start) });
  }

  return {
    day,
    open: true,
    slots,
    reason: slots.length === 0 ? "Ese día no queda un hueco de esa duración." : undefined,
  };
}

/** Los próximos N días con al menos un hueco — para el selector rápido de fechas. */
export async function getNextAvailableDays(options: {
  durationMin: number;
  specialistId?: string | null;
  days?: number;
  from?: Date;
}) {
  const { durationMin, specialistId, days = 14, from = new Date() } = options;
  const settings = await prisma.settings.findFirst();
  const tz = settings?.timezone ?? TZ;

  const results: { day: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const day = dayKey(addDays(from, i), tz);
    const availability = await getAvailability({ day, durationMin, specialistId });
    results.push({ day, count: availability.slots.length });
  }
  return results;
}

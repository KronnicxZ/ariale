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
  /**
   * Sin especialista fija, solo cuentan quienes saben hacer todo lo elegido.
   * Si no se pasa, cuenta el equipo entero (como antes).
   */
  serviceIds?: string[];
  /** Al reprogramar, la cita que se está moviendo no debe bloquearse a sí misma. */
  excludeAppointmentId?: string;
}): Promise<DayAvailability> {
  const { day, durationMin, specialistId, serviceIds, excludeAppointmentId } = options;

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

  // Sin especialista fija, la disponibilidad es la del equipo que sepa hacer
  // lo elegido: un hueco existe mientras quede al menos una de ellas libre.
  // Esta regla tiene que ser la misma que aplica al reservar, o se ofrecen
  // horas que luego nadie puede tomar.
  let specialists: { id: string }[];
  if (specialistId) {
    specialists = [{ id: specialistId }];
  } else {
    const equipo = await prisma.specialist.findMany({
      where: { active: true },
      select: { id: true, skills: { select: { serviceId: true } } },
    });
    const pedidos = serviceIds ?? [];
    specialists = equipo.filter((s) => {
      const sabe = s.skills.map((k) => k.serviceId);
      return sabe.length === 0 || pedidos.every((id) => sabe.includes(id));
    });
    if (equipo.length > 0 && specialists.length === 0) {
      return {
        day,
        open: true,
        slots: [],
        reason: "Nadie del equipo hace esa combinación de servicios en una sola cita.",
      };
    }
  }

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

// ---------------------------------------------------------------------------
// Reparto entre especialistas
// ---------------------------------------------------------------------------

export type GrupoReparto = {
  specialistId: string;
  specialistName: string;
  serviceIds: string[];
  durationMin: number;
};

/**
 * Nadie hace las dos áreas: Alejandra las uñas, Arianny la depilación. Si
 * una cita mezcla servicios de ambas, se reparte: cada quien lo suyo, a la
 * misma hora. Devuelve null cuando una sola persona puede con todo (o no
 * hay nada que repartir), y `huerfanos` con lo que nadie del equipo hace.
 */
export async function repartirServicios(serviceIds: string[]): Promise<{
  grupos: GrupoReparto[];
  huerfanos: string[];
} | null> {
  if (serviceIds.length === 0) return null;

  const [equipo, servicios] = await Promise.all([
    prisma.specialist.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, skills: { select: { serviceId: true } } },
    }),
    prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, durationMin: true },
    }),
  ]);

  const sabe = (s: (typeof equipo)[number]) => s.skills.map((k) => k.serviceId);
  const unaSola = equipo.some((s) => {
    const k = sabe(s);
    return k.length === 0 || serviceIds.every((id) => k.includes(id));
  });
  if (unaSola) return null;

  const duracion = new Map(servicios.map((s) => [s.id, s.durationMin]));
  const grupos = new Map<string, GrupoReparto>();
  const huerfanos: string[] = [];

  for (const id of serviceIds) {
    const dueno = equipo.find((s) => sabe(s).includes(id));
    if (!dueno) {
      huerfanos.push(id);
      continue;
    }
    const grupo = grupos.get(dueno.id) ?? {
      specialistId: dueno.id,
      specialistName: dueno.name,
      serviceIds: [],
      durationMin: 0,
    };
    grupo.serviceIds.push(id);
    grupo.durationMin += duracion.get(id) ?? 0;
    grupos.set(dueno.id, grupo);
  }

  return { grupos: [...grupos.values()], huerfanos };
}

/**
 * Huecos en los que TODAS las especialistas del reparto están libres a la
 * vez, cada una para la duración de su parte.
 */
export async function getAvailabilityRepartida(options: {
  day: string;
  grupos: GrupoReparto[];
  excludeAppointmentId?: string;
}): Promise<DayAvailability> {
  const { day, grupos, excludeAppointmentId } = options;

  const porGrupo = await Promise.all(
    grupos.map((g) =>
      getAvailability({
        day,
        durationMin: g.durationMin || 30,
        specialistId: g.specialistId,
        excludeAppointmentId,
      }),
    ),
  );

  const cerrado = porGrupo.find((a) => !a.open);
  if (cerrado) return cerrado;

  const [primero, ...resto] = porGrupo;
  const comunes = new Set(primero.slots.map((s) => s.time));
  for (const a of resto) {
    const suyas = new Set(a.slots.map((s) => s.time));
    for (const t of [...comunes]) if (!suyas.has(t)) comunes.delete(t);
  }
  const slots = primero.slots.filter((s) => comunes.has(s.time));
  const nombres = grupos.map((g) => g.specialistName).join(" y ");

  return {
    day,
    open: true,
    slots,
    reason: slots.length === 0 ? `${nombres} no coinciden libres ese día.` : undefined,
  };
}

import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addMinutes,
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";

export const TZ = "America/Caracas";

export const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
export const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** El "ahora" del salón, no el del servidor. */
export function nowInTz(tz = TZ): TZDate {
  return TZDate.tz(tz);
}

export function toTz(date: Date | string, tz = TZ): TZDate {
  return new TZDate(new Date(date), tz);
}

/** Día calendario del salón: "2026-09-01" */
export function dayKey(date: Date | string, tz = TZ): string {
  return format(toTz(date, tz), "yyyy-MM-dd");
}

/** Convierte "2026-09-01" + "14:30" al instante UTC correspondiente en la zona del salón. */
export function tzDateTimeToUtc(day: string, time: string, tz = TZ): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, tz).getTime());
}

export function startOfDayUtc(day: string, tz = TZ): Date {
  return tzDateTimeToUtc(day, "00:00", tz);
}

export function endOfDayUtc(day: string, tz = TZ): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, 23, 59, 59, 999, tz).getTime());
}

export function fmt(date: Date | string, pattern: string, tz = TZ): string {
  return format(toTz(date, tz), pattern, { locale: es });
}

/** "sáb 29 ago" */
export function fmtDayShort(date: Date | string, tz = TZ) {
  return fmt(date, "EEE d MMM", tz);
}

/** "Sábado 29 de agosto" */
export function fmtDayLong(date: Date | string, tz = TZ) {
  return fmt(date, "EEEE d 'de' MMMM", tz);
}

/** "01/09/2026" */
export function fmtDate(date: Date | string, tz = TZ) {
  return fmt(date, "dd/MM/yyyy", tz);
}

/** "3:00 pm" */
export function fmtTime(date: Date | string, tz = TZ) {
  return fmt(date, "h:mm a", tz).toLowerCase();
}

/** "1:00 pm — 3:00 pm" */
export function fmtRange(start: Date | string, end: Date | string, tz = TZ) {
  return `${fmtTime(start, tz)} — ${fmtTime(end, tz)}`;
}

/** "hoy", "mañana", "sáb 29 ago" */
export function fmtRelativeDay(date: Date | string, tz = TZ) {
  const now = nowInTz(tz);
  const target = toTz(date, tz);
  if (isSameDay(now, target)) return "hoy";
  if (isSameDay(addDays(now, 1), target)) return "mañana";
  if (isSameDay(subDays(now, 1), target)) return "ayer";
  return fmtDayShort(date, tz);
}

/** "2h 30min" a partir de minutos */
export function fmtDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export type Period = {
  from: Date;
  to: Date;
  label: string;
};

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "last-month"
  | "last7"
  | "last30"
  | "year"
  | "all";

/** Rangos predefinidos como los del panel original (hoy / semana / este mes / mes anterior). */
export function resolvePeriod(preset: PeriodPreset, tz = TZ): Period {
  const now = nowInTz(tz);
  const asUtc = (d: Date) => new Date(d.getTime());

  switch (preset) {
    case "today":
      return { from: asUtc(startOfDay(now)), to: asUtc(endOfDay(now)), label: "Hoy" };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: asUtc(startOfDay(y)), to: asUtc(endOfDay(y)), label: "Ayer" };
    }
    case "week":
      return {
        from: asUtc(startOfDay(subDays(now, 6))),
        to: asUtc(endOfDay(now)),
        label: "Últimos 7 días",
      };
    case "last7":
      return {
        from: asUtc(startOfDay(subDays(now, 6))),
        to: asUtc(endOfDay(now)),
        label: "Últimos 7 días",
      };
    case "last30":
      return {
        from: asUtc(startOfDay(subDays(now, 29))),
        to: asUtc(endOfDay(now)),
        label: "Últimos 30 días",
      };
    case "last-month": {
      const prev = subMonths(now, 1);
      return {
        from: asUtc(startOfMonth(prev)),
        to: asUtc(endOfMonth(prev)),
        label: "Mes anterior",
      };
    }
    case "year":
      return {
        from: asUtc(startOfDay(subDays(now, 364))),
        to: asUtc(endOfDay(now)),
        label: "Último año",
      };
    case "all":
      return {
        from: new Date(2000, 0, 1),
        to: asUtc(endOfDay(addDays(now, 3650))),
        label: "Máximo",
      };
    case "month":
    default:
      return {
        from: asUtc(startOfMonth(now)),
        to: asUtc(endOfMonth(now)),
        label: "Este mes",
      };
  }
}

/** El mismo rango, corrido un periodo hacia atrás — para comparar contra el anterior. */
export function previousPeriod(period: Period): Period {
  const span = period.to.getTime() - period.from.getTime();
  return {
    from: new Date(period.from.getTime() - span - 1),
    to: new Date(period.from.getTime() - 1),
    label: "Periodo anterior",
  };
}

export { addDays, addMinutes, differenceInMinutes, isSameDay, startOfDay, endOfDay };

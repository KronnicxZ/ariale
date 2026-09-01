import { TZ, endOfDayUtc, resolvePeriod, startOfDayUtc, type Period, type PeriodPreset } from "@/lib/date";

const VALID: PeriodPreset[] = [
  "today",
  "yesterday",
  "week",
  "month",
  "last-month",
  "last7",
  "last30",
  "year",
  "all",
];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Lee ?periodo=&desde=&hasta= de la URL. El rango manual gana sobre el atajo.
 */
export function periodFromParams(
  params: SearchParams,
  fallback: PeriodPreset = "month",
  tz = TZ,
): { period: Period; preset: PeriodPreset; from?: string; to?: string } {
  const desde = one(params.desde);
  const hasta = one(params.hasta);

  if (desde && hasta && ISO_DAY.test(desde) && ISO_DAY.test(hasta)) {
    const start = startOfDayUtc(desde, tz);
    const end = endOfDayUtc(hasta, tz);
    if (start <= end) {
      return {
        period: { from: start, to: end, label: `${desde} — ${hasta}` },
        preset: fallback,
        from: desde,
        to: hasta,
      };
    }
  }

  const raw = one(params.periodo) as PeriodPreset | undefined;
  const preset = raw && VALID.includes(raw) ? raw : fallback;
  return { period: resolvePeriod(preset, tz), preset };
}

export function stringParam(params: SearchParams, key: string) {
  const value = one(params[key]);
  return value && value.trim() ? value.trim() : undefined;
}

export function pageParam(params: SearchParams, key = "pagina") {
  const raw = Number(one(params[key]));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
}

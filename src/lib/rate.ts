import "server-only";
import { prisma } from "@/lib/db";
import { dayKey, startOfDayUtc } from "@/lib/date";

/**
 * Tasa BCV del día (bolívares por dólar).
 *
 * Se cachea una fila por día en ExchangeRate. Si el negocio está en modo
 * MANUAL, manda el valor que cargó la dueña y no se consulta nada.
 */

const SOURCES: { name: string; url: string; pick: (json: unknown) => number | null }[] = [
  {
    name: "pydolarve",
    url: "https://pydolarve.org/api/v2/tipo-cambio?currency=usd",
    pick: (json) => num((json as Record<string, unknown>)?.price),
  },
  {
    name: "pydolarve-bcv",
    url: "https://pydolarve.org/api/v1/dollar?page=bcv",
    pick: (json) => {
      const monitors = (json as { monitors?: Record<string, { price?: unknown }> })?.monitors;
      return num(monitors?.usd?.price);
    },
  },
  {
    name: "dolarapi",
    url: "https://ve.dolarapi.com/v1/dolares/oficial",
    pick: (json) => num((json as Record<string, unknown>)?.promedio),
  },
];

function num(value: unknown): number | null {
  const n = typeof value === "string" ? parseFloat(value.replace(",", ".")) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchFromSources(): Promise<{ rate: number; source: string } | null> {
  for (const source of SOURCES) {
    try {
      const res = await fetch(source.url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 3600 },
      });
      if (!res.ok) continue;
      const rate = source.pick(await res.json());
      if (rate) return { rate, source: source.name };
    } catch {
      // probamos la siguiente fuente
    }
  }
  return null;
}

export type RateInfo = {
  rate: number;
  source: string;
  date: Date | null;
  stale: boolean;
  manual: boolean;
};

export async function getRate(): Promise<RateInfo> {
  const settings = await prisma.settings.findFirst();

  if (settings?.rateMode === "MANUAL") {
    return {
      rate: settings.manualRate ?? 0,
      source: "Manual",
      date: settings.updatedAt,
      stale: false,
      manual: true,
    };
  }

  const today = startOfDayUtc(dayKey(new Date(), settings?.timezone ?? undefined));
  const cached = await prisma.exchangeRate.findUnique({ where: { date: today } });
  if (cached) {
    return { rate: cached.rate, source: cached.source, date: cached.date, stale: false, manual: false };
  }

  const fresh = await fetchFromSources();
  if (fresh) {
    const saved = await prisma.exchangeRate.upsert({
      where: { date: today },
      create: { date: today, rate: fresh.rate, source: fresh.source },
      update: { rate: fresh.rate, source: fresh.source, fetchedAt: new Date() },
    });
    return { rate: saved.rate, source: saved.source, date: saved.date, stale: false, manual: false };
  }

  // Sin internet: usamos la última tasa conocida antes que romper la pantalla.
  const last = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
  if (last) {
    return { rate: last.rate, source: last.source, date: last.date, stale: true, manual: false };
  }

  return {
    rate: settings?.manualRate ?? 0,
    source: "Sin tasa",
    date: null,
    stale: true,
    manual: false,
  };
}

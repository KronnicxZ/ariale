import "server-only";
import { prisma } from "@/lib/db";
import { dayKey, startOfDayUtc } from "@/lib/date";

/**
 * Tasa BCV del día (bolívares por dólar).
 *
 * Se cachea una fila por día en ExchangeRate. Si el negocio está en modo
 * MANUAL, manda el valor que cargó la dueña y no se consulta nada.
 */

/**
 * Fuentes gratuitas y sin registro, en orden de preferencia. Todas dan la
 * tasa OFICIAL del BCV, que es la que factura el estudio; la paralela no
 * sirve aquí aunque venga en la misma respuesta.
 *
 * pydolarve dejó de responder (404 en todos sus endpoints) y salió de la
 * lista. Si dolarapi también cae, la app se queda con la última tasa
 * guardada y lo dice, que es mejor que enseñar un número inventado.
 */
const SOURCES: { name: string; url: string; pick: (json: unknown) => number | null }[] = [
  {
    name: "DolarAPI",
    url: "https://ve.dolarapi.com/v1/dolares/oficial",
    pick: (json) => num((json as Record<string, unknown>)?.promedio),
  },
  {
    name: "DolarAPI",
    url: "https://ve.dolarapi.com/v1/dolares",
    pick: (json) => {
      const lista = json as { fuente?: string; promedio?: unknown }[] | undefined;
      const oficial = lista?.find((d) => d.fuente === "oficial");
      return num(oficial?.promedio);
    },
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

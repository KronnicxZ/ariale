import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  CalendarX2,
  ChartNoAxesCombined,
  Clock,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DayTimeline } from "@/components/panel/day-timeline";
import { WeekStrip } from "@/components/panel/week-strip";
import { getToday, getUpcomingStrip } from "@/data/today";
import { fmtDayLong } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { firstName } from "@/lib/utils";

export const metadata = { title: "Hoy" };

export default async function TodayPage() {
  const settings = await getSettings();
  const [{ today, appointments, next, counts, money }, strip] = await Promise.all([
    getToday(settings.timezone),
    getUpcomingStrip(settings.timezone),
  ]);

  const hour = new Date().getUTCHours() - 4;
  const greeting =
    hour >= 5 && hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-5">
      <header>
        <p className="text-muted-foreground text-sm">
          {greeting}, {firstName(settings.businessName)}
        </p>
        <h1 className="font-display text-[1.75rem] leading-tight capitalize sm:text-[2.1rem]">
          {fmtDayLong(`${today}T12:00:00Z`, "UTC")}
        </h1>
      </header>

      <Button asChild className="h-12 w-full text-base sm:h-11 sm:w-auto">
        <Link href="/panel/agenda/nueva">
          <CalendarPlus className="size-5" />
          Agendar una cita
        </Link>
      </Button>

      {counts.pendingConfirm > 0 || counts.overdue > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {counts.pendingConfirm > 0 ? (
            <Link
              href="/panel/agenda?estado=PENDING"
              className="bg-primary/8 ring-primary/20 hover:bg-primary/12 flex flex-1 items-center gap-2.5 rounded-2xl px-4 py-3 text-sm ring-1 transition"
            >
              <Clock className="text-primary size-4 shrink-0" />
              <span className="flex-1">
                <strong>{counts.pendingConfirm}</strong>{" "}
                {counts.pendingConfirm === 1 ? "cita espera" : "citas esperan"} tu confirmación
              </span>
              <ArrowRight className="text-muted-foreground size-4" />
            </Link>
          ) : null}
          {counts.overdue > 0 ? (
            <Link
              href="/panel/cobrar?estado=vencidas"
              className="bg-warning/10 ring-warning/25 hover:bg-warning/15 flex flex-1 items-center gap-2.5 rounded-2xl px-4 py-3 text-sm ring-1 transition"
            >
              <AlertTriangle className="text-warning size-4 shrink-0" />
              <span className="flex-1">
                <strong>{counts.overdue}</strong> por cobrar vencidas
              </span>
              <ArrowRight className="text-muted-foreground size-4" />
            </Link>
          ) : null}
        </div>
      ) : null}

      <WeekStrip days={strip} today={today} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl">Tu día</h2>
          <p className="text-muted-foreground text-sm">
            {counts.total === 0
              ? "Sin citas"
              : `${counts.total} ${counts.total === 1 ? "cita" : "citas"} · ${counts.attended} atendidas · ${formatUsd(money.expectedCents)} previstos`}
          </p>
        </div>

        {appointments.length === 0 ? (
          <div className="border-border/70 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
            <CalendarX2 className="text-muted-foreground/50 size-8" />
            <p className="text-muted-foreground max-w-xs text-sm">
              Hoy no hay nada agendado. Buen momento para escribirle a las clientas que no vienen
              hace rato.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/panel/recordatorios">Ver recordatorios</Link>
            </Button>
          </div>
        ) : (
          <DayTimeline
            appointments={appointments}
            business={settings.businessName}
            countryCode={settings.countryCode}
            tz={settings.timezone}
            highlightId={next?.id}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/panel/agenda">
              Ver toda la agenda
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/panel/modo-agenda">
              <LayoutGrid className="size-4" />
              Modo agenda
            </Link>
          </Button>
        </div>
      </section>

      {/* El dinero, resumido. El análisis a fondo vive en Reportes. */}
      <section className="surface p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">Este mes</h2>
          <Link
            href="/panel/reportes"
            className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            <ChartNoAxesCombined className="size-4" />
            Ver reportes
          </Link>
        </div>

        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-muted-foreground text-xs">Ventas</dt>
            <dd className="font-numeric mt-0.5 text-lg sm:text-xl">
              {formatUsd(money.monthSalesCents, true)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Cobrado</dt>
            <dd className="font-numeric mt-0.5 text-lg sm:text-xl">
              {formatUsd(money.monthCollectedCents, true)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Por cobrar</dt>
            <dd className="font-numeric text-destructive mt-0.5 text-lg sm:text-xl">
              {formatUsd(money.receivableCents, true)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

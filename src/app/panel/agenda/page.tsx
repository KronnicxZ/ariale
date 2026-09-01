import Link from "next/link";
import { CalendarPlus, CalendarX2, LayoutGrid, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { DayStrip } from "@/components/panel/day-strip";
import { AppointmentRow } from "@/components/panel/appointment-row";
import { AgendaFilters } from "./agenda-filters";
import { getDayAgenda, getWeekStrip } from "@/data/agenda";
import { dayKey, fmtDayLong } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { stringParam } from "@/lib/period";
import type { AppointmentStatus } from "@/generated/prisma/client";

export const metadata = { title: "Agenda" };

const STATUSES = new Set(["PENDING", "CONFIRMED", "ATTENDED", "CANCELLED", "NO_SHOW"]);

export default async function AgendaPage(props: PageProps<"/panel/agenda">) {
  const params = await props.searchParams;
  const settings = await getSettings();

  const today = dayKey(new Date(), settings.timezone);
  const day = stringParam(params, "dia") ?? today;
  const specialistId = stringParam(params, "especialista");
  const statusParam = stringParam(params, "estado");
  const status =
    statusParam && STATUSES.has(statusParam) ? (statusParam as AppointmentStatus) : undefined;

  const [{ appointments, specialists, counts, revenueCents }, strip] = await Promise.all([
    getDayAgenda({ day, specialistId, status, tz: settings.timezone }),
    getWeekStrip(day, settings.timezone),
  ]);

  // Una sola línea en vez de cuatro fichas de contadores.
  const summary =
    counts.total === 0
      ? "Sin citas ese día"
      : [
          `${counts.total} ${counts.total === 1 ? "cita" : "citas"}`,
          counts.pending > 0 ? `${counts.pending} por confirmar` : null,
          counts.attended > 0 ? `${counts.attended} atendidas` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agenda"
        description={fmtDayLong(`${day}T12:00:00Z`, "UTC")}
        actions={
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/panel/agenda/nueva">
              <CalendarPlus className="size-4" />
              Nueva cita
            </Link>
          </Button>
        }
      />

      {/* En el móvil la acción principal ocupa todo el ancho, al alcance del pulgar. */}
      <Button asChild className="h-12 w-full text-base sm:hidden">
        <Link href="/panel/agenda/nueva">
          <CalendarPlus className="size-5" />
          Agendar una cita
        </Link>
      </Button>

      <DayStrip days={strip} current={day} today={today} />

      <p className="text-muted-foreground text-sm">{summary}</p>

      <AgendaFilters specialists={specialists} specialistId={specialistId} status={statusParam} />

      {appointments.length === 0 ? (
        <EmptyState
          icon={<CalendarX2 className="size-8" />}
          title="No hay citas ese día"
          description="Cuando agendes, aparecerán aquí ordenadas por hora."
          action={
            <Button asChild size="sm">
              <Link href="/panel/agenda/nueva">
                <CalendarPlus className="size-4" />
                Agendar ahora
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {appointments.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                business={settings.businessName}
                countryCode={settings.countryCode}
                tz={settings.timezone}
              />
            ))}
          </div>
          <p className="text-muted-foreground text-right text-sm">
            Facturación prevista del día:{" "}
            <strong className="text-foreground">{formatUsd(revenueCents)}</strong>
          </p>
        </>
      )}

      {/* Accesos secundarios al final, sin competir con la agenda. */}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/panel/modo-agenda?dia=${day}`}>
            <LayoutGrid className="size-4" />
            Modo agenda
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/panel/agenda/enlaces">
            <Link2 className="size-4" />
            Enlaces de reserva
          </Link>
        </Button>
      </div>
    </div>
  );
}

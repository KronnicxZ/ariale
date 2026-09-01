import Link from "next/link";
import { CheckCheck, Clock, MessageCircle, StickyNote } from "lucide-react";
import { AppointmentStatusBadge } from "@/components/panel/status-badge";
import { fmtDuration, fmtTime } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { appointmentConfirmedMessage, waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

type Appointment = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: string;
  note: string | null;
  client: { id: string; name: string; phone: string };
  specialist: { id: string; name: string; color: string };
  services: { priceCents: number; durationMin: number; service: { name: string } }[];
  sale?: { id: string; status: string } | null;
};

/**
 * La agenda del día como una línea de tiempo: la hora manda, y cada cita
 * cabe de un vistazo en el móvil. Es la vista principal de la app.
 */
export function DayTimeline({
  appointments,
  business,
  countryCode,
  tz,
  highlightId,
}: {
  appointments: Appointment[];
  business: string;
  countryCode: string;
  tz: string;
  /** La próxima cita se resalta con un filete dorado. */
  highlightId?: string | null;
}) {
  return (
    <ol className="space-y-2">
      {appointments.map((appointment) => {
        const totalCents = appointment.services.reduce((sum, s) => sum + s.priceCents, 0);
        const duration = appointment.services.reduce((sum, s) => sum + s.durationMin, 0);
        const done = appointment.status === "ATTENDED";
        const isNext = appointment.id === highlightId;

        const message = appointmentConfirmedMessage(
          {
            startAt: appointment.startAt,
            client: appointment.client,
            services: appointment.services,
          },
          business,
          totalCents,
        );

        return (
          <li
            key={appointment.id}
            className={cn(
              "surface flex items-stretch gap-3 p-3",
              isNext && "ring-primary/45 ring-2",
              done && "opacity-65",
            )}
          >
            <div className="w-[4.5rem] shrink-0 py-0.5 text-center whitespace-nowrap">
              <p className="font-numeric text-[0.95rem]">{fmtTime(appointment.startAt, tz)}</p>
              <p className="text-muted-foreground text-[0.68rem]">{fmtDuration(duration)}</p>
              {isNext ? (
                <span className="bg-primary/15 text-primary mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold">
                  <Clock className="size-2.5" />
                  Ahora
                </span>
              ) : null}
            </div>

            <span
              className="w-[3px] shrink-0 rounded-full"
              style={{ background: appointment.specialist.color }}
              aria-hidden
            />

            <Link href={`/panel/agenda/${appointment.id}`} className="min-w-0 flex-1 py-0.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={cn("font-medium", done && "line-through")}>
                  {appointment.client.name}
                </span>
                <AppointmentStatusBadge status={appointment.status} />
              </span>
              <span className="text-muted-foreground mt-0.5 block truncate text-sm">
                {appointment.services.map((s) => s.service.name).join(" + ")}
              </span>
              <span className="text-muted-foreground block text-xs">
                {appointment.specialist.name} · {formatUsd(totalCents)}
                {appointment.sale ? " · cobrada" : ""}
              </span>
              {appointment.note ? (
                <span className="text-muted-foreground mt-1 flex items-start gap-1.5 text-xs italic">
                  <StickyNote className="mt-0.5 size-3 shrink-0" />
                  {appointment.note}
                </span>
              ) : null}
            </Link>

            <div className="flex shrink-0 flex-col items-center justify-center gap-1.5">
              <a
                href={waLink(appointment.client.phone, message, countryCode)}
                target="_blank"
                rel="noreferrer"
                className="bg-success/12 text-success hover:bg-success/20 grid size-9 place-items-center rounded-full transition"
                aria-label={`Escribir a ${appointment.client.name}`}
              >
                <MessageCircle className="size-4" />
              </a>
              {!appointment.sale && done ? (
                <Link
                  href={`/panel/ventas/nueva?cita=${appointment.id}`}
                  className="bg-primary/12 text-primary hover:bg-primary/20 grid size-9 place-items-center rounded-full transition"
                  aria-label="Cobrar"
                >
                  <CheckCheck className="size-4" />
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

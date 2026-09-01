import Link from "next/link";
import { ChevronRight, MessageCircle, StickyNote } from "lucide-react";
import { AppointmentStatusBadge } from "@/components/panel/status-badge";
import { fmtDuration, fmtTime } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { waLink, appointmentConfirmedMessage } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

type Appointment = {
  id: string;
  startAt: Date;
  status: string;
  note: string | null;
  client: { id: string; name: string; phone: string };
  specialist: { id: string; name: string; color: string };
  services: { priceCents: number; durationMin: number; service: { name: string } }[];
};

export function AppointmentRow({
  appointment,
  business,
  countryCode,
  tz,
  href,
  showSpecialist = true,
}: {
  appointment: Appointment;
  business: string;
  countryCode: string;
  tz: string;
  href?: string;
  showSpecialist?: boolean;
}) {
  const totalCents = appointment.services.reduce((sum, s) => sum + s.priceCents, 0);
  const duration = appointment.services.reduce((sum, s) => sum + s.durationMin, 0);
  const cancelled = appointment.status === "CANCELLED" || appointment.status === "NO_SHOW";

  const message = appointmentConfirmedMessage(
    { startAt: appointment.startAt, client: appointment.client, services: appointment.services },
    business,
    totalCents,
  );

  return (
    <div
      className={cn(
        "bg-card flex items-stretch gap-3 rounded-2xl border p-3 transition",
        cancelled && "opacity-60",
      )}
    >
      <div className="flex w-16 shrink-0 flex-col justify-center text-center">
        <p className="text-sm font-semibold tabular-nums">{fmtTime(appointment.startAt, tz)}</p>
        <p className="text-muted-foreground text-[0.7rem]">{fmtDuration(duration)}</p>
      </div>

      <span
        className="w-1 shrink-0 rounded-full"
        style={{ background: appointment.specialist.color }}
      />

      <Link href={href ?? `/panel/agenda/${appointment.id}`} className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("font-medium", cancelled && "line-through")}>
            {appointment.client.name}
          </span>
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-sm">
          {appointment.services.map((s) => s.service.name).join(" + ")}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {showSpecialist ? `${appointment.specialist.name} · ` : ""}
          {formatUsd(totalCents)}
        </p>
        {appointment.note ? (
          <p className="text-muted-foreground mt-1.5 flex items-start gap-1.5 text-xs italic">
            <StickyNote className="mt-0.5 size-3 shrink-0" />
            {appointment.note}
          </p>
        ) : null}
      </Link>

      <div className="flex shrink-0 flex-col items-center justify-center gap-1">
        <a
          href={waLink(appointment.client.phone, message, countryCode)}
          target="_blank"
          rel="noreferrer"
          className="bg-success/12 text-success hover:bg-success/20 grid size-9 place-items-center rounded-full transition"
          aria-label={`Escribir a ${appointment.client.name} por WhatsApp`}
        >
          <MessageCircle className="size-4" />
        </a>
        <Link
          href={href ?? `/panel/agenda/${appointment.id}`}
          className="text-muted-foreground hover:text-foreground grid size-9 place-items-center rounded-full transition"
          aria-label="Ver detalle"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

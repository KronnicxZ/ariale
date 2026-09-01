import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CircleCheck,
  CircleSlash,
  MessageCircle,
  Receipt,
  ShieldAlert,
  StickyNote,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { AppointmentStatusBadge, SaleStatusBadge } from "@/components/panel/status-badge";
import { getAppointment } from "@/data/agenda";
import { fmtDayLong, fmtDuration, fmtRange } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { formatPhone } from "@/lib/utils";
import { appointmentConfirmedMessage, waLink } from "@/lib/whatsapp";
import {
  deleteAppointmentAction,
  updateAppointmentStatusAction,
} from "@/actions/appointments";
import { RescheduleDialog } from "./reschedule-dialog";

export const metadata = { title: "Cita" };

export default async function AppointmentPage(props: PageProps<"/panel/agenda/[id]">) {
  const { id } = await props.params;
  const [appointment, settings, rateInfo] = await Promise.all([
    getAppointment(id),
    getSettings(),
    getRate(),
  ]);
  if (!appointment) notFound();

  const totalCents = appointment.services.reduce((sum, s) => sum + s.priceCents, 0);
  const duration = appointment.services.reduce((sum, s) => sum + s.durationMin, 0);

  const message = appointmentConfirmedMessage(
    { startAt: appointment.startAt, client: appointment.client, services: appointment.services },
    settings.businessName,
    totalCents,
    rateInfo.rate,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/panel/agenda"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition"
      >
        <ArrowLeft className="size-4" />
        Volver a la agenda
      </Link>

      <div className="bg-card space-y-4 rounded-2xl border p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-sm capitalize">
              {fmtDayLong(appointment.startAt, settings.timezone)}
            </p>
            <h1 className="font-heading text-2xl font-semibold">
              {fmtRange(appointment.startAt, appointment.endAt, settings.timezone)}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">{fmtDuration(duration)}</p>
          </div>
          <AppointmentStatusBadge status={appointment.status} />
        </div>

        <div className="flex items-center gap-3 border-t pt-4">
          <span
            className="size-10 shrink-0 rounded-full"
            style={{ background: appointment.specialist.color }}
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{appointment.client.name}</p>
            <p className="text-muted-foreground text-sm">
              {formatPhone(appointment.client.phone, settings.countryCode)} ·{" "}
              {appointment.specialist.name}
            </p>
          </div>
          <a
            href={waLink(appointment.client.phone, message, settings.countryCode)}
            target="_blank"
            rel="noreferrer"
            className="bg-success/12 text-success hover:bg-success/20 grid size-10 shrink-0 place-items-center rounded-full transition"
            aria-label="Escribir por WhatsApp"
          >
            <MessageCircle className="size-5" />
          </a>
        </div>

        <ul className="space-y-2 border-t pt-4">
          {appointment.services.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{entry.service.name}</span>
                <span className="text-muted-foreground text-xs">
                  {fmtDuration(entry.durationMin)}
                  {entry.service.bodyZone ? ` · ${entry.service.bodyZone}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatUsd(entry.priceCents)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 border-t pt-2">
            <span className="font-semibold">Total</span>
            <Money cents={totalCents} rate={rateInfo.rate} className="items-end font-semibold" />
          </li>
        </ul>

        {appointment.note ? (
          <p className="bg-muted/60 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm">
            <StickyNote className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            {appointment.note}
          </p>
        ) : null}

        {appointment.client.allergies ? (
          <p className="bg-warning/10 text-warning-foreground flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm">
            <ShieldAlert className="text-warning mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Ojo:</strong> {appointment.client.allergies}
            </span>
          </p>
        ) : null}
      </div>

      {/* Acciones de estado */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {appointment.status === "PENDING" ? (
          <form action={updateAppointmentStatusAction} className="contents">
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="status" value="CONFIRMED" />
            <Button type="submit" className="h-11">
              <CircleCheck className="size-4" />
              Confirmar
            </Button>
          </form>
        ) : null}

        {appointment.status !== "ATTENDED" && appointment.status !== "CANCELLED" ? (
          <form action={updateAppointmentStatusAction} className="contents">
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="status" value="ATTENDED" />
            <Button type="submit" variant="outline" className="h-11">
              <CircleCheck className="size-4" />
              Atendida
            </Button>
          </form>
        ) : null}

        <RescheduleDialog
          appointmentId={appointment.id}
          serviceIds={appointment.services.map((s) => s.serviceId)}
          specialistId={appointment.specialistId}
          today={new Date().toISOString().slice(0, 10)}
        />

        {appointment.status !== "CANCELLED" ? (
          <form action={updateAppointmentStatusAction} className="contents">
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="status" value="CANCELLED" />
            <Button type="submit" variant="outline" className="text-destructive h-11">
              <CircleSlash className="size-4" />
              Cancelar
            </Button>
          </form>
        ) : null}
      </div>

      {/* Venta ligada */}
      <div className="bg-card rounded-2xl border p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Receipt className="text-muted-foreground size-4" />
          Cobro
        </h2>
        {appointment.sale ? (
          <Link
            href={`/panel/ventas/${appointment.sale.id}`}
            className="hover:bg-accent/40 -mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition"
          >
            <span>
              <span className="block text-sm font-medium">Venta #{appointment.sale.number}</span>
              <span className="text-muted-foreground text-xs">
                Cobrado {formatUsd(appointment.sale.paidCents)} de{" "}
                {formatUsd(appointment.sale.totalCents)}
              </span>
            </span>
            <SaleStatusBadge status={appointment.sale.status} />
          </Link>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Esta cita todavía no se ha cobrado.
            </p>
            <Button asChild className="h-11 w-full sm:w-auto">
              <Link href={`/panel/ventas/nueva?cita=${appointment.id}`}>
                <Receipt className="size-4" />
                Registrar el cobro
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/panel/clientes/${appointment.client.id}`}>
            <UserRound className="size-4" />
            Ver ficha de la clienta
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/panel/agenda?dia=${appointment.startAt.toISOString().slice(0, 10)}`}>
            <CalendarClock className="size-4" />
            Ver ese día
          </Link>
        </Button>
        <form action={deleteAppointmentAction} className="ml-auto">
          <input type="hidden" name="id" value={appointment.id} />
          <Button type="submit" variant="ghost" size="sm" className="text-destructive">
            <Trash2 className="size-4" />
            Eliminar
          </Button>
        </form>
      </div>
    </div>
  );
}

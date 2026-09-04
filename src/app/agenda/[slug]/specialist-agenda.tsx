"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  CalendarX2,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  PartyPopper,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingWizard, type BookingResult } from "@/components/booking/booking-wizard";
import { ClientPicker, type ClientSelection } from "@/components/booking/client-picker";
import { AppointmentStatusBadge } from "@/components/panel/status-badge";
import type { ClientOption, ServiceOption } from "@/components/booking/types";
import { specialistBookAction, type BookingOutcome } from "@/actions/booking";
import { specialistLogoutAction } from "@/actions/auth";
import { updateAppointmentStatusAction } from "@/actions/appointments";
import { fmtDuration, fmtTime, fmtDayLong } from "@/lib/date";
import { formatBs, formatUsd } from "@/lib/money";
import { appointmentConfirmedMessage, waLink } from "@/lib/whatsapp";
import { cn, initials } from "@/lib/utils";

type Appointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  note: string | null;
  source: string;
  client: { id: string; name: string; phone: string };
  services: { name: string; priceCents: number; durationMin: number }[];
};

type Props = {
  specialist: { id: string; name: string; slug: string; color: string };
  business: { name: string; countryCode: string; timezone: string };
  day: string;
  today: string;
  maxDay: string;
  closedWeekdays: number[];
  appointments: Appointment[];
  services: ServiceOption[];
  clients: ClientOption[];
  rate: number;
};

export function SpecialistAgenda({
  specialist,
  business,
  day,
  today,
  maxDay,
  closedWeekdays,
  appointments,
  services,
  clients,
  rate,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<"agenda" | "new">("agenda");
  const [client, setClient] = useState<ClientSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<BookingOutcome, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  const goToDay = (target: string) => {
    router.push(`/agenda/${specialist.slug}?dia=${target}`);
  };

  const shiftDay = (amount: number) => {
    const [y, m, d] = day.split("-").map(Number);
    goToDay(new Date(Date.UTC(y, m - 1, d + amount)).toISOString().slice(0, 10));
  };

  const tomorrow = (() => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  })();

  const handleSubmit = (result: BookingResult) =>
    new Promise<void>((resolve) => {
      if (!client) {
        setError("Elige una clienta primero.");
        resolve();
        return;
      }
      setError(null);
      startTransition(async () => {
        const outcome = await specialistBookAction({
          ...result,
          client:
            client.kind === "existing"
              ? { kind: "existing", id: client.id }
              : { kind: "new", name: client.name, phone: client.phone },
        });
        if (outcome.ok) {
          setDone(outcome);
          router.refresh();
        } else {
          setError(outcome.error);
        }
        resolve();
      });
    });

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-card sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
          style={{ background: specialist.color }}
        >
          {initials(specialist.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{specialist.name}</p>
          <p className="text-muted-foreground text-xs">
            {view === "agenda" ? "Tu agenda del día" : "Nueva cita"}
          </p>
        </div>
        {view === "new" ? (
          <button
            type="button"
            onClick={() => {
              setView("agenda");
              setDone(null);
              setClient(null);
              setError(null);
            }}
            className="text-primary shrink-0 text-sm font-medium"
          >
            Citas
          </button>
        ) : null}
        <form action={specialistLogoutAction}>
          <input type="hidden" name="slug" value={specialist.slug} />
          <button type="submit" className="text-muted-foreground shrink-0 text-sm">
            Salir
          </button>
        </form>
      </header>

      {view === "new" ? (
        done ? (
          <BookingDone
            outcome={done}
            rate={rate}
            onAgain={() => {
              setDone(null);
              setClient(null);
            }}
            onBack={() => {
              setView("agenda");
              setDone(null);
              setClient(null);
            }}
          />
        ) : (
          <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
            <section className="mb-7 space-y-3">
              <header>
                <p className="text-primary text-xs font-semibold tracking-widest uppercase">
                  Nueva cita
                </p>
                <h1 className="font-display text-2xl font-semibold">¿Para quién agendamos?</h1>
                <p className="text-muted-foreground text-sm">
                  Elige una clienta o registra una nueva. La cita queda confirmada.
                </p>
              </header>
              <ClientPicker
                clients={clients}
                value={client}
                onChange={setClient}
                countryCode={business.countryCode}
              />
            </section>

            <BookingWizard
              services={services}
              specialists={[]}
              lockedSpecialistId={specialist.id}
              today={today}
              maxDay={maxDay}
              closedWeekdays={closedWeekdays}
              rate={rate}
              submitLabel="Confirmar cita"
              pendingLabel="Agendando…"
              onSubmit={handleSubmit}
              submitting={pending}
              error={error}
            />
          </div>
        )
      ) : (
        <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 pb-28">
          <div className="mb-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => shiftDay(-1)}
              className="border-border bg-card grid size-9 place-items-center rounded-full border"
              aria-label="Día anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="min-w-0 flex-1 truncate text-center text-sm font-medium capitalize">
              {fmtDayLong(`${day}T12:00:00Z`, "UTC")}
            </p>
            <button
              type="button"
              onClick={() => shiftDay(1)}
              className="border-border bg-card grid size-9 place-items-center rounded-full border"
              aria-label="Día siguiente"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="bg-muted mb-4 flex gap-1 rounded-full p-1">
            {[
              { key: today, label: "Hoy" },
              { key: tomorrow, label: "Mañana" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => goToDay(option.key)}
                className={cn(
                  "flex-1 rounded-full py-2 text-sm font-medium transition",
                  day === option.key ? "bg-card shadow-sm" : "text-muted-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="text-muted-foreground mb-3 text-sm">
            {appointments.length === 0
              ? "Sin citas"
              : `${appointments.length} ${appointments.length === 1 ? "cita" : "citas"}`}
          </p>

          {appointments.length === 0 ? (
            <div className="border-border/70 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
              <CalendarX2 className="text-muted-foreground/50 size-8" />
              <p className="text-muted-foreground text-sm">
                No tienes citas ese día. Aprovecha y agenda una.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {appointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  business={business}
                  rate={rate}
                />
              ))}
            </ul>
          )}

          <div className="bg-card/95 safe-bottom fixed inset-x-0 bottom-0 border-t px-4 pt-3 backdrop-blur">
            <Button
              onClick={() => setView("new")}
              className="mx-auto mb-1 flex h-12 w-full max-w-2xl text-base"
            >
              <CalendarPlus className="size-5" />
              Nueva cita
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function AppointmentCard({
  appointment,
  business,
  rate,
}: {
  appointment: Appointment;
  business: { name: string; countryCode: string; timezone: string };
  rate: number;
}) {
  const totalCents = appointment.services.reduce((sum, s) => sum + s.priceCents, 0);
  const duration = appointment.services.reduce((sum, s) => sum + s.durationMin, 0);
  const cancelled = appointment.status === "CANCELLED" || appointment.status === "NO_SHOW";

  const message = appointmentConfirmedMessage(
    {
      startAt: appointment.startAt,
      client: appointment.client,
      services: appointment.services.map((s) => ({ service: { name: s.name } })),
    },
    business.name,
    totalCents,
    rate,
  );

  return (
    <li
      className={cn(
        "border-primary/25 surface p-3",
        cancelled && "border-border opacity-60",
      )}
    >
      <div className="flex gap-3">
        <div className="w-20 shrink-0 border-r pr-3 text-center whitespace-nowrap">
          <p className="text-sm font-semibold tabular-nums">
            {fmtTime(appointment.startAt, business.timezone)}
          </p>
          {/* El guion evita que se lea como una segunda hora de inicio. */}
          <p className="text-muted-foreground text-[0.7rem] tabular-nums">
            – {fmtTime(appointment.endAt, business.timezone)}
          </p>
          <p className="text-muted-foreground mt-1 text-[0.68rem]">{fmtDuration(duration)}</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("font-semibold", cancelled && "line-through")}>
              {appointment.client.name}
            </span>
            <AppointmentStatusBadge status={appointment.status} />
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {appointment.services.map((s) => s.name).join(" + ")}
          </p>
          <p className="text-muted-foreground text-xs">
            {appointment.source === "CLIENT" ? "Agendada por la clienta · " : ""}
            {formatUsd(totalCents)}
            {rate ? ` · ${formatBs(totalCents, rate)}` : ""}
          </p>
          {appointment.note ? (
            <p className="text-muted-foreground mt-1.5 flex items-start gap-1.5 text-xs italic">
              <StickyNote className="mt-0.5 size-3 shrink-0" />
              {appointment.note}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex gap-2 border-t pt-3">
        <a
          href={waLink(appointment.client.phone, message, business.countryCode)}
          target="_blank"
          rel="noreferrer"
          className="bg-success/12 text-success flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium"
        >
          <MessageCircle className="size-4" />
          WhatsApp
        </a>

        {appointment.status === "PENDING" ? (
          <form action={updateAppointmentStatusAction} className="flex-1">
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="status" value="CONFIRMED" />
            <button
              type="submit"
              className="bg-primary text-primary-foreground flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium"
            >
              <Check className="size-4" />
              Confirmar
            </button>
          </form>
        ) : appointment.status === "CONFIRMED" ? (
          <form action={updateAppointmentStatusAction} className="flex-1">
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="status" value="ATTENDED" />
            <button
              type="submit"
              className="bg-secondary text-secondary-foreground flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium"
            >
              <Check className="size-4" />
              Atendida
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function BookingDone({
  outcome,
  rate,
  onAgain,
  onBack,
}: {
  outcome: Extract<BookingOutcome, { ok: true }>;
  rate: number;
  onAgain: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
      <span className="bg-primary text-primary-foreground mb-4 grid size-16 place-items-center rounded-full">
        <PartyPopper className="size-8" />
      </span>
      <p className="text-primary text-xs font-semibold tracking-widest uppercase">Agenda lista</p>
      <h2 className="font-display mt-1 text-3xl font-semibold">¡Cita confirmada!</h2>

      <dl className="bg-muted/60 mt-6 w-full max-w-sm space-y-2 rounded-2xl p-4 text-left text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Cuándo</dt>
          <dd className="text-right font-medium capitalize">
            {outcome.whenLabel} · {outcome.timeLabel}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Servicio</dt>
          <dd className="text-right font-medium">{outcome.servicesLabel}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t pt-2">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="text-right font-semibold">
            {formatUsd(outcome.totalCents)}
            {rate ? (
              <span className="text-muted-foreground block text-xs font-normal">
                {formatBs(outcome.totalCents, rate)}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
        <Button onClick={onAgain} className="h-12 text-base">
          Agendar otra
        </Button>
        <Button onClick={onBack} variant="outline" className="h-12 text-base">
          Ver mi agenda
        </Button>
      </div>
    </div>
  );
}

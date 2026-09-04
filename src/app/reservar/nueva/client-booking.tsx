"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingWizard, type BookingResult } from "@/components/booking/booking-wizard";
import type { PackageBalance, ServiceOption, SpecialistOption } from "@/components/booking/types";
import { clientBookAction, type BookingOutcome } from "@/actions/booking";
import { formatBs, formatUsd } from "@/lib/money";

export function ClientBooking({
  services,
  specialists,
  packages,
  today,
  maxDay,
  closedWeekdays,
  rate,
  autoConfirm,
  business,
}: {
  services: ServiceOption[];
  specialists: SpecialistOption[];
  packages: PackageBalance[];
  today: string;
  maxDay: string;
  closedWeekdays: number[];
  rate: number;
  autoConfirm: boolean;
  business: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<BookingOutcome, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (result: BookingResult) =>
    new Promise<void>((resolve) => {
      setError(null);
      startTransition(async () => {
        const outcome = await clientBookAction(result);
        if (outcome.ok) {
          setDone(outcome);
          router.refresh();
        } else {
          setError(outcome.error);
        }
        resolve();
      });
    });

  if (done) {
    const confirmed = done.status === "CONFIRMED";
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="bg-primary text-primary-foreground mb-4 grid size-16 place-items-center rounded-full">
          <CalendarCheck className="size-8" />
        </span>
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">
          {confirmed ? "Confirmada" : "Agendada"}
        </p>
        <h2 className="font-display mt-1 text-3xl font-semibold">
          {confirmed ? "¡Tu cita está confirmada!" : "¡Tu cita quedó agendada!"}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {confirmed
            ? `Te esperamos en ${business}.`
            : "Te confirmamos en breve por WhatsApp."}
        </p>

        <dl className="bg-muted/60 mt-6 w-full max-w-sm space-y-2 rounded-2xl p-4 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Cuándo</dt>
            <dd className="text-right font-medium capitalize">
              {done.whenLabel} · {done.timeLabel}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Servicio</dt>
            <dd className="text-right font-medium">{done.servicesLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Con</dt>
            <dd className="text-right font-medium">{done.specialistName}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t pt-2">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="text-right font-semibold">
              {formatUsd(done.totalCents)}
              {rate ? (
                <span className="text-muted-foreground block text-xs font-normal">
                  {formatBs(done.totalCents, rate)}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
          <Button onClick={() => router.push("/reservar")} className="h-12 text-base">
            Perfecto
          </Button>
          <Button variant="outline" onClick={() => setDone(null)} className="h-12 text-base">
            Agendar otra
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="mb-5">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">Tu cita</p>
        <h1 className="font-display text-2xl font-semibold">Reserva en un minuto</h1>
      </header>

      <BookingWizard
        services={services}
        specialists={specialists}
        packages={packages}
        today={today}
        maxDay={maxDay}
        closedWeekdays={closedWeekdays}
        permiteDiseno
        rate={rate}
        submitLabel={autoConfirm ? "Confirmar cita" : "Reservar cita"}
        pendingLabel="Reservando…"
        onSubmit={handleSubmit}
        submitting={pending}
        error={error}
      />
    </>
  );
}

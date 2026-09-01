"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarCheck, MessageCircle, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingWizard, type BookingResult } from "@/components/booking/booking-wizard";
import { ClientPicker, type ClientSelection } from "@/components/booking/client-picker";
import type { ClientOption, ServiceOption, SpecialistOption } from "@/components/booking/types";
import { adminBookAction, type BookingOutcome } from "@/actions/booking";
import { formatBs, formatUsd } from "@/lib/money";

type Props = {
  clients: ClientOption[];
  services: ServiceOption[];
  specialists: SpecialistOption[];
  today: string;
  maxDay: string;
  rate: number;
  countryCode: string;
};

export function NewAppointment({
  clients,
  services,
  specialists,
  today,
  maxDay,
  rate,
  countryCode,
}: Props) {
  const router = useRouter();
  const [client, setClient] = useState<ClientSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<BookingOutcome, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (result: BookingResult) =>
    new Promise<void>((resolve) => {
      if (!client) {
        setError("Elige una clienta primero.");
        resolve();
        return;
      }
      setError(null);
      startTransition(async () => {
        const outcome = await adminBookAction({
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

  if (done) {
    return (
      <div className="mx-auto max-w-md py-8 text-center">
        <span className="bg-success/12 text-success mx-auto mb-4 grid size-16 place-items-center rounded-full">
          <PartyPopper className="size-8" />
        </span>
        <h2 className="font-display text-2xl font-semibold">¡Cita agendada!</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Ya está en la agenda de {done.specialistName}.
        </p>

        <dl className="bg-muted/50 mt-6 space-y-2 rounded-2xl p-4 text-left text-sm">
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

        <div className="mt-6 flex flex-col gap-2">
          <Button asChild className="h-11">
            <Link href={`/panel/agenda/${done.appointmentId}`}>
              <CalendarCheck className="size-4" />
              Ver la cita
            </Link>
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => {
              setDone(null);
              setClient(null);
            }}
          >
            Agendar otra
          </Button>
          <Button asChild variant="ghost">
            <Link href="/panel/recordatorios">
              <MessageCircle className="size-4" />
              Avisar por WhatsApp
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <section className="mb-7 space-y-3">
        <header>
          <h2 className="font-display text-xl font-semibold">¿Para quién agendamos?</h2>
          <p className="text-muted-foreground text-sm">
            Elige una clienta o registra una nueva.
          </p>
        </header>
        <ClientPicker
          clients={clients}
          value={client}
          onChange={setClient}
          countryCode={countryCode}
        />
      </section>

      <BookingWizard
        services={services}
        specialists={specialists}
        today={today}
        maxDay={maxDay}
        rate={rate}
        submitLabel="Confirmar cita"
        pendingLabel="Agendando…"
        onSubmit={handleSubmit}
        submitting={pending}
        error={error}
      />
    </div>
  );
}

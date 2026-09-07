"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CalendarCheck, CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookingWizard, type BookingResult } from "@/components/booking/booking-wizard";
import {
  FALTA_NOMBRE,
  type PackageBalance,
  type ServiceOption,
  type SpecialistOption,
} from "@/components/booking/types";
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
  countryCode,
  yaIdentificada,
  preseleccion,
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
  countryCode: string;
  /** Con sesión abierta no se le vuelve a pedir el teléfono. */
  yaIdentificada: boolean;
  preseleccion: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<BookingOutcome, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  // Lo elegido en el asistente, esperando a que diga quién es. El asistente
  // no se desmonta mientras tanto —solo se esconde—, así que volver atrás
  // no pierde ni el servicio ni la hora.
  const [pendiente, setPendiente] = useState<BookingResult | null>(null);

  const reservar = (result: BookingResult, quien?: { phone: string; name?: string }) =>
    new Promise<void>((resolve) => {
      setError(null);
      startTransition(async () => {
        const outcome = await clientBookAction(result, quien);
        if (outcome.ok) {
          setPendiente(null);
          setDone(outcome);
          router.refresh();
        } else {
          setError(outcome.error);
        }
        resolve();
      });
    });

  const alTerminar = (result: BookingResult) => {
    if (yaIdentificada) return reservar(result);
    setError(null);
    setPendiente(result);
  };

  if (done) return <Confirmada done={done} business={business} rate={rate} router={router} />;

  return (
    <>
      {/* Escondido, no desmontado: el asistente conserva lo elegido. */}
      <div className={pendiente ? "hidden" : undefined}>
        <BookingWizard
          services={services}
          specialists={specialists}
          packages={packages}
          today={today}
          maxDay={maxDay}
          closedWeekdays={closedWeekdays}
          permiteDiseno
          elegirEspecialista={false}
          rate={rate}
          initial={preseleccion.length > 0 ? { serviceIds: preseleccion } : undefined}
          submitLabel={yaIdentificada ? (autoConfirm ? "Confirmar cita" : "Reservar cita") : "Continuar"}
          pendingLabel="Reservando…"
          onSubmit={alTerminar}
          submitting={pending}
          error={pendiente ? null : error}
        />
      </div>

      {pendiente ? (
        <QuienEres
          countryCode={countryCode}
          autoConfirm={autoConfirm}
          pending={pending}
          error={error}
          onVolver={() => {
            setError(null);
            setPendiente(null);
          }}
          onConfirmar={(quien) => reservar(pendiente, quien)}
        />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * El último paso: el teléfono.
 *
 * Va aquí y no en la entrada porque aquí ya hay algo a cambio —el día y la
 * hora elegidos— y porque a estas alturas el número hace falta de verdad:
 * es como el estudio la reconoce y por donde le confirman.
 */
function QuienEres({
  countryCode,
  autoConfirm,
  pending,
  error,
  onVolver,
  onConfirmar,
}: {
  countryCode: string;
  autoConfirm: boolean;
  pending: boolean;
  error: string | null;
  onVolver: () => void;
  onConfirmar: (quien: { phone: string; name?: string }) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  const pideNombre = error === FALTA_NOMBRE;
  const otroError = error && error !== FALTA_NOMBRE ? error : null;

  return (
    <div>
      <button
        type="button"
        onClick={onVolver}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition"
      >
        <ArrowLeft className="size-4" />
        Cambiar día u hora
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirmar({ phone, name: name.trim() || undefined });
        }}
        className="space-y-4"
      >
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {pideNombre ? "¿Cómo te llamas?" : "Ya casi"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {pideNombre
              ? "Es la primera vez que agendas con nosotras. Con tu nombre queda lista."
              : "Solo falta tu número, para reconocerte y confirmarte la cita."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Tu número de teléfono</Label>
          <div className="flex items-center gap-2">
            <span className="surface-sm flex h-12 shrink-0 items-center px-3 text-sm font-medium">
              {countryCode}
            </span>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="0424 135 4645"
              className="h-12"
              required
              autoFocus
            />
          </div>
        </div>

        {pideNombre ? (
          <div className="space-y-1.5">
            <Label htmlFor="name">Tu nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="h-12"
              required
              autoFocus
            />
          </div>
        ) : null}

        {otroError ? (
          <p className="text-destructive flex items-start gap-1.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {otroError}
          </p>
        ) : null}

        <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {autoConfirm ? "Confirmar cita" : "Reservar cita"}
        </Button>
      </form>
    </div>
  );
}

function Confirmada({
  done,
  business,
  rate,
  router,
}: {
  done: Extract<BookingOutcome, { ok: true }>;
  business: string;
  rate: number;
  router: ReturnType<typeof useRouter>;
}) {
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
        {confirmed ? `Te esperamos en ${business}.` : "Te confirmamos en breve por WhatsApp."}
      </p>

      <dl className="bg-muted/60 mt-6 w-full max-w-sm space-y-2 rounded-2xl p-4 text-left text-sm">
        {/* Con varias citas a distinta hora, una lista no sirve: cada una
            se cuenta entera, porque son dos visitas distintas. */}
        {done.citas && done.citas.length > 1 ? (
          done.citas.map((cita, i) => (
            <div key={i} className={i > 0 ? "border-t pt-2" : undefined}>
              <p className="font-medium capitalize">
                {cita.whenLabel} · {cita.timeLabel}
              </p>
              <p className="text-muted-foreground text-xs">
                {cita.servicesLabel} · con {cita.specialistName}
              </p>
            </div>
          ))
        ) : (
          <>
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
          </>
        )}
        {/* A nombre de quién quedó. Cuando el teléfono ya estaba registrado
            no se pide el nombre, y una cifra mal tecleada agendaría a nombre
            de otra: dicho aquí, se ve al momento. */}
        <div className="flex justify-between gap-4 border-t pt-2">
          <dt className="text-muted-foreground">A nombre de</dt>
          <dd className="text-right font-medium">{done.clientName}</dd>
        </div>
        <div className="flex justify-between gap-4">
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
        {/* El recordatorio lo pone su propio teléfono: es lo más barato que
            hay contra los plantones. */}
        <a
          href={`/api/cita/${done.appointmentId}`}
          className="border-border/70 hover:bg-muted/60 inline-flex h-12 items-center justify-center gap-2 rounded-full border text-base font-medium transition"
        >
          <CalendarPlus className="size-4.5" />
          Añadir a mi calendario
        </a>
        <Button onClick={() => router.push("/reservar/mis-citas")} className="h-12 text-base">
          Ver mis citas
        </Button>
      </div>
    </div>
  );
}

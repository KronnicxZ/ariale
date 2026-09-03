"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ServicePicker } from "@/components/booking/service-picker";
import { DayPicker } from "@/components/booking/day-picker";
import { SlotPicker, prettyTime, type SlotOption } from "@/components/booking/slot-picker";
import type { PackageBalance, ServiceOption, SpecialistOption } from "@/components/booking/types";
import { fetchSlotsAction } from "@/actions/appointments";
import { formatBs, formatUsd } from "@/lib/money";
import { fmtDuration } from "@/lib/date";
import { cn } from "@/lib/utils";

export type BookingResult = {
  serviceIds: string[];
  specialistId: string | null;
  day: string;
  time: string;
  note: string;
};

type Props = {
  services: ServiceOption[];
  specialists: SpecialistOption[];
  /** Hoy en la zona horaria del salón, en yyyy-MM-dd. */
  today: string;
  maxDay?: string;
  rate?: number;
  packages?: PackageBalance[];
  /** Fija la especialista y oculta el selector (zona de la especialista). */
  lockedSpecialistId?: string;
  /** Permite "cualquier especialista disponible" (zona pública). */
  allowAnySpecialist?: boolean;
  submitLabel: string;
  pendingLabel?: string;
  onSubmit: (result: BookingResult) => Promise<void> | void;
  submitting?: boolean;
  error?: string | null;
  /** Preselección al reprogramar o duplicar. */
  initial?: Partial<BookingResult>;
};

type PasoId = "servicio" | "quien" | "dia" | "hora";

const ETIQUETA: Record<PasoId, string> = {
  servicio: "Servicio",
  quien: "Con quién",
  dia: "Día",
  hora: "Hora",
};

/**
 * Una decisión por pantalla: servicio → (con quién) → día → hora. La barra
 * de abajo resume lo elegido y lleva el botón de seguir; al final, el de
 * reservar. Volver atrás nunca pierde lo ya elegido.
 */
export function BookingWizard({
  services,
  specialists,
  today,
  maxDay,
  rate,
  packages = [],
  lockedSpecialistId,
  allowAnySpecialist = false,
  submitLabel,
  pendingLabel = "Guardando…",
  onSubmit,
  submitting = false,
  error,
  initial,
}: Props) {
  const [serviceIds, setServiceIds] = useState<string[]>(initial?.serviceIds ?? []);
  const [specialistId, setSpecialistId] = useState<string | null>(
    lockedSpecialistId ?? initial?.specialistId ?? (allowAnySpecialist ? null : (specialists[0]?.id ?? null)),
  );
  const [day, setDay] = useState(initial?.day ?? today);
  const [time, setTime] = useState<string | null>(initial?.time ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [noteOpen, setNoteOpen] = useState(Boolean(initial?.note));

  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotReason, setSlotReason] = useState<string | undefined>();
  const [loadingSlots, startLoadingSlots] = useTransition();
  const requestId = useRef(0);
  const topRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => services.filter((s) => serviceIds.includes(s.id)),
    [services, serviceIds],
  );
  const totalCents = selected.reduce((sum, s) => sum + s.priceCents, 0);
  const totalMinutes = selected.reduce((sum, s) => sum + s.durationMin, 0);

  // Servicios cubiertos por algún bono con saldo.
  const coveredServiceIds = useMemo(() => {
    const set = new Set<string>();
    for (const pkg of packages) {
      if (pkg.remaining > 0) for (const id of pkg.serviceIds) set.add(id);
    }
    return set;
  }, [packages]);

  // Solo ofrecemos especialistas que sepan hacer todo lo seleccionado.
  const eligibleSpecialists = useMemo(() => {
    if (serviceIds.length === 0) return specialists;
    return specialists.filter((s) => serviceIds.every((id) => s.serviceIds.includes(id)));
  }, [specialists, serviceIds]);

  // Si la elegida deja de poder hacer todo lo seleccionado, la corregimos
  // durante el render en vez de guardar un estado que habría que sincronizar.
  const activeSpecialistId = lockedSpecialistId
    ? lockedSpecialistId
    : specialistId && eligibleSpecialists.some((s) => s.id === specialistId)
      ? specialistId
      : allowAnySpecialist
        ? null
        : (eligibleSpecialists[0]?.id ?? null);

  // Nadie hace todo lo elegido: se reparte, cada quien lo suyo, a la misma
  // hora. El servidor crea una cita por especialista con este mismo criterio.
  const reparto = useMemo(() => {
    if (lockedSpecialistId || serviceIds.length === 0 || eligibleSpecialists.length > 0) {
      return null;
    }
    const grupos = new Map<string, { specialist: SpecialistOption; services: ServiceOption[] }>();
    for (const service of selected) {
      const dueno = specialists.find((s) => s.serviceIds.includes(service.id));
      if (!dueno) return null; // algo que nadie hace: el servidor lo explicará
      const grupo = grupos.get(dueno.id) ?? { specialist: dueno, services: [] };
      grupo.services.push(service);
      grupos.set(dueno.id, grupo);
    }
    return grupos.size >= 2 ? [...grupos.values()] : null;
  }, [lockedSpecialistId, serviceIds.length, eligibleSpecialists.length, selected, specialists]);

  // El paso "con quién" existe si hay algo que decidir, o algo que explicar.
  const preguntaQuien =
    !lockedSpecialistId &&
    specialists.length > 1 &&
    (reparto !== null ||
      (allowAnySpecialist ? eligibleSpecialists.length > 0 : eligibleSpecialists.length > 1));

  const pasos = useMemo<PasoId[]>(
    () => (preguntaQuien ? ["servicio", "quien", "dia", "hora"] : ["servicio", "dia", "hora"]),
    [preguntaQuien],
  );

  const [pasoIndex, setPasoIndex] = useState(() =>
    initial?.time ? Number.MAX_SAFE_INTEGER : 0,
  );
  const indice = Math.min(pasoIndex, pasos.length - 1);
  const paso = pasos[indice];
  const esUltimo = indice === pasos.length - 1;

  // Cada vez que cambia lo que afecta la duración o el día, repreguntamos los
  // huecos al servidor. `requestId` descarta respuestas que llegan tarde.
  useEffect(() => {
    if (serviceIds.length === 0) return;
    const id = ++requestId.current;
    startLoadingSlots(async () => {
      const result = await fetchSlotsAction({
        day,
        serviceIds,
        specialistId: activeSpecialistId,
      });
      if (id !== requestId.current) return;
      setSlots(result.slots);
      setSlotReason(result.reason);
      setTime((current) =>
        current && result.slots.some((s) => s.time === current) ? current : null,
      );
    });
  }, [day, serviceIds, activeSpecialistId]);

  // Al cambiar de paso, arriba del todo: en el teléfono el paso anterior
  // pudo dejar la página a media altura.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [indice]);

  const visibleSlots = serviceIds.length === 0 ? [] : slots;

  const puedeSeguir =
    paso === "servicio"
      ? serviceIds.length > 0
      : paso === "hora"
        ? Boolean(time)
        : true;
  const ready =
    serviceIds.length > 0 &&
    Boolean(time) &&
    (allowAnySpecialist || Boolean(activeSpecialistId) || reparto !== null);

  const handleToggle = (id: string) => {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const seguir = () => setPasoIndex(Math.min(indice + 1, pasos.length - 1));
  const volver = () => setPasoIndex(Math.max(indice - 1, 0));

  const handleSubmit = async () => {
    if (!ready || !time) return;
    await onSubmit({ serviceIds, specialistId: activeSpecialistId, day, time, note: note.trim() });
  };

  // Lo que se ve en la barra de abajo según el paso.
  const resumenLinea1 =
    selected.length === 0 ? "Elige un servicio" : selected.map((s) => s.name).join(" + ");
  const resumenLinea2 =
    selected.length === 0
      ? `${pasos.length} pasos: servicio, día y hora`
      : time
        ? `${fmtDuration(totalMinutes)} · ${prettyTime(time)}`
        : paso === "hora"
          ? `${fmtDuration(totalMinutes)} · elige la hora`
          : fmtDuration(totalMinutes);

  return (
    <div className="pb-40" ref={topRef}>
      {/* Indicador: los pasos ya hechos se pueden tocar para volver. */}
      <ol className="mb-6 flex gap-2">
        {pasos.map((p, i) => {
          const hecho = i < indice;
          const actual = i === indice;
          return (
            <li key={p} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => hecho && setPasoIndex(i)}
                disabled={!hecho}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-medium transition disabled:cursor-default",
                  actual
                    ? "bg-primary text-primary-foreground"
                    : hecho
                      ? "bg-primary/12 text-primary hover:bg-primary/20"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {hecho ? <Check className="size-3.5" /> : <span>{i + 1}</span>}
                <span className="truncate">{ETIQUETA[p]}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {indice > 0 ? (
        <button
          type="button"
          onClick={volver}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition"
        >
          <ArrowLeft className="size-4" />
          Volver
        </button>
      ) : null}

      {paso === "servicio" ? (
        <section className="space-y-3">
          <header>
            <h2 className="font-display text-2xl font-semibold">Elige el servicio</h2>
            <p className="text-muted-foreground text-sm">
              Puedes combinar más de uno. El tiempo se suma solo.
            </p>
          </header>
          <ServicePicker
            services={services}
            selected={serviceIds}
            onToggle={handleToggle}
            rate={rate}
            packageServiceIds={coveredServiceIds}
          />
        </section>
      ) : null}

      {paso === "quien" && reparto ? (
        <section className="space-y-3">
          <header>
            <h2 className="font-display text-2xl font-semibold">¿Con quién?</h2>
            <p className="text-muted-foreground text-sm">
              Nadie hace las dos cosas: se reparte sola, cada quien lo suyo.
            </p>
          </header>
          <div className="surface space-y-3 p-4">
            {reparto.map((g) => (
              <div key={g.specialist.id} className="flex items-start gap-3">
                <span
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ background: g.specialist.color }}
                />
                <p className="text-sm">
                  <span className="font-semibold">{g.specialist.name}: </span>
                  <span className="text-muted-foreground">
                    {g.services.map((s) => s.name).join(" + ")}
                  </span>
                </p>
              </div>
            ))}
            <p className="text-muted-foreground border-border/70 border-t pt-3 text-xs">
              Quedan dos citas a la misma hora, una con cada una.
            </p>
          </div>
        </section>
      ) : null}

      {paso === "quien" && !reparto ? (
        <section className="space-y-3">
          <header>
            <h2 className="font-display text-2xl font-semibold">¿Con quién?</h2>
            <p className="text-muted-foreground text-sm">
              {eligibleSpecialists.length < specialists.length
                ? "Mostramos solo quienes hacen todo lo que elegiste."
                : "Elige a quien prefieras, o deja que sea la primera libre."}
            </p>
          </header>
          <div className="grid gap-2 sm:grid-cols-2">
            {allowAnySpecialist ? (
              <button
                type="button"
                onClick={() => setSpecialistId(null)}
                className={cn(
                  "rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition",
                  activeSpecialistId === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                La primera disponible
                <span
                  className={cn(
                    "mt-0.5 block text-xs font-normal",
                    activeSpecialistId === null ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  Más horarios para elegir.
                </span>
              </button>
            ) : null}
            {eligibleSpecialists.map((specialist) => (
              <button
                key={specialist.id}
                type="button"
                onClick={() => setSpecialistId(specialist.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition",
                  activeSpecialistId === specialist.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: specialist.color }}
                />
                {specialist.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {paso === "dia" ? (
        <section className="space-y-3">
          <header>
            <h2 className="font-display text-2xl font-semibold">Elige el día</h2>
            <p className="text-muted-foreground text-sm">
              La cita dura {fmtDuration(totalMinutes)}.
            </p>
          </header>
          <DayPicker value={day} onChange={setDay} startDay={today} minDay={today} maxDay={maxDay} />
        </section>
      ) : null}

      {paso === "hora" ? (
        <>
          <section className="space-y-3">
            <header>
              <h2 className="font-display text-2xl font-semibold">Elige la hora</h2>
              <p className="text-muted-foreground text-sm">
                {time ? (
                  <>
                    Te esperamos a las <strong>{prettyTime(time)}</strong> · termina ~
                    {fmtDuration(totalMinutes)} después.
                  </>
                ) : (
                  "Solo se muestran las horas donde de verdad hay sitio."
                )}
              </p>
            </header>
            <SlotPicker
              slots={visibleSlots}
              value={time}
              onChange={setTime}
              loading={loadingSlots}
              emptyMessage={slotReason}
            />
          </section>

          <section className="mt-6">
            <button
              type="button"
              onClick={() => setNoteOpen((open) => !open)}
              className="surface border-border flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-medium">¿Quieres dejar una nota?</span>
                <span className="text-muted-foreground block text-xs">
                  Opcional · diseño, llegada tarde, algo que debamos saber
                </span>
              </span>
              <ChevronDown
                className={cn("text-muted-foreground size-5 transition", noteOpen && "rotate-180")}
              />
            </button>
            {noteOpen ? (
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ej.: quiero francesa con dorado"
                rows={3}
                maxLength={400}
                className="mt-2"
              />
            ) : null}
          </section>
        </>
      ) : null}

      {error && esUltimo ? (
        <p className="text-destructive mt-4 flex items-start gap-1.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {/* Resumen fijo abajo: siempre visible mientras se elige. */}
      <div className="bg-card/95 safe-bottom fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-end justify-between gap-4 pb-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{resumenLinea1}</p>
            <p className="text-muted-foreground truncate text-xs">{resumenLinea2}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-numeric text-lg leading-none font-semibold">
              {formatUsd(totalCents)}
            </p>
            {rate ? (
              <p className="text-muted-foreground text-xs tabular-nums">
                {formatBs(totalCents, rate)}
              </p>
            ) : null}
          </div>
        </div>
        {esUltimo ? (
          <Button
            onClick={handleSubmit}
            disabled={!ready || submitting}
            className="mx-auto mb-1 flex h-12 w-full max-w-2xl text-base"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitting ? pendingLabel : submitLabel}
          </Button>
        ) : (
          <Button
            onClick={seguir}
            disabled={!puedeSeguir}
            className="mx-auto mb-1 flex h-12 w-full max-w-2xl text-base"
          >
            Continuar
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

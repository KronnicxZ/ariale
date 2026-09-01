"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
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

  // Sin servicios elegidos no mostramos horarios, aunque queden en memoria.
  const visibleSlots = serviceIds.length === 0 ? [] : slots;

  const step = serviceIds.length === 0 ? 1 : !time ? (visibleSlots.length ? 3 : 2) : 3;
  const ready =
    serviceIds.length > 0 && Boolean(time) && (allowAnySpecialist || Boolean(activeSpecialistId));

  const handleToggle = (id: string) => {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const handleSubmit = async () => {
    if (!ready || !time) return;
    await onSubmit({ serviceIds, specialistId: activeSpecialistId, day, time, note: note.trim() });
  };

  return (
    <div className="pb-36">
      <ol className="mb-5 flex gap-2">
        {[
          { n: 1, label: "Servicio" },
          { n: 2, label: "Día" },
          { n: 3, label: "Hora" },
        ].map((s) => (
          <li
            key={s.n}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-center text-xs font-medium transition",
              step === s.n
                ? "bg-primary text-primary-foreground"
                : step > s.n
                  ? "bg-primary/12 text-primary"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {s.n} · {s.label}
          </li>
        ))}
      </ol>

      <section className="space-y-3">
        <header>
          <h2 className="font-heading text-xl font-semibold">Elige el servicio</h2>
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

      {!lockedSpecialistId && specialists.length > 1 ? (
        <section className="mt-7 space-y-3">
          <header>
            <h2 className="font-heading text-xl font-semibold">¿Con quién?</h2>
            {eligibleSpecialists.length < specialists.length ? (
              <p className="text-muted-foreground text-sm">
                Mostramos solo quienes hacen todo lo que elegiste.
              </p>
            ) : null}
          </header>
          <div className="flex flex-wrap gap-2">
            {allowAnySpecialist ? (
              <button
                type="button"
                onClick={() => setSpecialistId(null)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  activeSpecialistId === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                La primera disponible
              </button>
            ) : null}
            {eligibleSpecialists.map((specialist) => (
              <button
                key={specialist.id}
                type="button"
                onClick={() => setSpecialistId(specialist.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                  activeSpecialistId === specialist.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: specialist.color }}
                />
                {specialist.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-7 space-y-3">
        <header>
          <h2 className="font-heading text-xl font-semibold">Elige el día</h2>
          <p className="text-muted-foreground text-sm">
            {selected.length > 0
              ? `La cita dura ${fmtDuration(totalMinutes)}.`
              : "Primero elige al menos un servicio."}
          </p>
        </header>
        <DayPicker value={day} onChange={setDay} startDay={today} minDay={today} maxDay={maxDay} />
      </section>

      <section className="mt-7 space-y-3">
        <header>
          <h2 className="font-heading text-xl font-semibold">Elige la hora</h2>
          {time ? (
            <p className="text-muted-foreground text-sm">
              Te esperamos a las <strong>{prettyTime(time)}</strong> · termina ~
              {fmtDuration(totalMinutes)} después.
            </p>
          ) : null}
        </header>
        {serviceIds.length === 0 ? (
          <p className="text-muted-foreground bg-muted/50 rounded-xl px-4 py-5 text-center text-sm">
            Elige un servicio y te mostramos los horarios libres.
          </p>
        ) : (
          <SlotPicker
            slots={visibleSlots}
            value={time}
            onChange={setTime}
            loading={loadingSlots}
            emptyMessage={slotReason}
          />
        )}
      </section>

      <section className="mt-6">
        <button
          type="button"
          onClick={() => setNoteOpen((open) => !open)}
          className="border-border bg-card flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left"
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

      {error ? (
        <p className="text-destructive mt-4 flex items-start gap-1.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {/* Resumen fijo abajo: siempre visible mientras se elige. */}
      <div className="bg-card/95 safe-bottom fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-end justify-between gap-4 pb-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {selected.length === 0
                ? "Elige un servicio"
                : selected.map((s) => s.name).join(" + ")}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {selected.length === 0
                ? "Servicio, día y hora"
                : time
                  ? `${fmtDuration(totalMinutes)} · ${prettyTime(time)}`
                  : `${fmtDuration(totalMinutes)} · elige la hora`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-heading text-lg leading-none font-semibold">
              {formatUsd(totalCents)}
            </p>
            {rate ? (
              <p className="text-muted-foreground text-xs tabular-nums">
                {formatBs(totalCents, rate)}
              </p>
            ) : null}
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!ready || submitting}
          className="mx-auto mb-1 flex h-12 w-full max-w-2xl text-base"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {submitting ? pendingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ServicePicker } from "@/components/booking/service-picker";
import { DayPicker } from "@/components/booking/day-picker";
import { SlotPicker, prettyTime, type SlotOption } from "@/components/booking/slot-picker";
import {
  areaDe,
  type PackageBalance,
  type ServiceOption,
  type SpecialistOption,
} from "@/components/booking/types";
import { fetchSlotsAction } from "@/actions/appointments";
import { formatBs, formatUsd } from "@/lib/money";
import { fmtDuration } from "@/lib/date";
import { cn } from "@/lib/utils";
import { CampoDiseno } from "@/components/booking/campo-diseno";

export type BookingResult = {
  serviceIds: string[];
  specialistId: string | null;
  day: string;
  time: string;
  note: string;
  /** Foto o enlace del diseño que quiere la clienta. Vacío si no dejó nada. */
  referenceUrl: string;
};

type Props = {
  services: ServiceOption[];
  specialists: SpecialistOption[];
  /** Hoy en la zona horaria del salón, en yyyy-MM-dd. */
  today: string;
  maxDay?: string;
  /** Días de la semana en que el estudio no abre (0 = domingo). */
  closedWeekdays?: number[];
  /** Deja adjuntar el diseño. Solo en la zona de la clienta. */
  permiteDiseno?: boolean;
  rate?: number;
  packages?: PackageBalance[];
  /** Fija la especialista y oculta el selector (zona de la especialista). */
  lockedSpecialistId?: string;
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
  closedWeekdays,
  permiteDiseno = false,
  rate,
  packages = [],
  lockedSpecialistId,
  submitLabel,
  pendingLabel = "Guardando…",
  onSubmit,
  submitting = false,
  error,
  initial,
}: Props) {
  const [serviceIds, setServiceIds] = useState<string[]>(initial?.serviceIds ?? []);
  // Null a propósito: hasta que no hay servicios elegidos no se sabe a quién
  // le toca, y `sugerida` lo resuelve en cada render.
  const [specialistId, setSpecialistId] = useState<string | null>(
    lockedSpecialistId ?? initial?.specialistId ?? null,
  );
  const [day, setDay] = useState(initial?.day ?? today);
  const [time, setTime] = useState<string | null>(initial?.time ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [noteOpen, setNoteOpen] = useState(Boolean(initial?.note));
  const [referenceUrl, setReferenceUrl] = useState("");

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

  // Dos áreas (uñas/pies y depilación): si la cita mezcla las dos, se
  // reparte por área aunque alguien sepa hacer algo de la otra —cada quien
  // lo suyo, a la misma hora. Para cada área, quien cubra todo lo pedido
  // prefiriendo a la que menos hace de la otra. Misma regla que el servidor.
  const reparto = useMemo(() => {
    if (lockedSpecialistId || selected.length === 0) return null;
    const areas = [...new Set(selected.map((s) => areaDe(s.categoryKind)))];
    if (areas.length < 2) return null;

    const grupos = new Map<string, { specialist: SpecialistOption; services: ServiceOption[] }>();
    for (const area of areas) {
      const delArea = selected.filter((s) => areaDe(s.categoryKind) === area);
      const otras = selected.filter((s) => areaDe(s.categoryKind) !== area);
      let mejor: SpecialistOption | null = null;
      let peso = Number.POSITIVE_INFINITY;
      for (const e of specialists) {
        if (!delArea.every((s) => e.serviceIds.includes(s.id))) continue;
        const p = otras.filter((s) => e.serviceIds.includes(s.id)).length;
        if (p < peso) {
          mejor = e;
          peso = p;
        }
      }
      if (!mejor) return null; // algo que nadie hace: el servidor lo explicará
      const g = grupos.get(mejor.id) ?? { specialist: mejor, services: [] };
      g.services.push(...delArea);
      grupos.set(mejor.id, g);
    }
    return grupos.size >= 2 ? [...grupos.values()] : null;
  }, [lockedSpecialistId, selected, specialists]);

  // Solo ofrecemos especialistas que sepan hacer todo lo seleccionado; con
  // reparto no se elige a nadie: van las dos.
  const eligibleSpecialists = useMemo(() => {
    if (serviceIds.length === 0) return specialists;
    if (reparto) return [];
    return specialists.filter((s) => serviceIds.every((id) => s.serviceIds.includes(id)));
  }, [specialists, serviceIds, reparto]);

  /**
   * Quién viene sugerida por defecto. No es "la primera de la lista": es la
   * que de verdad se dedica a lo que pediste. Alejandra también sabe hacer
   * cejas, así que si solo eliges depilación las dos son elegibles — y ahí
   * gana Arianny, porque casi no hace nada de la otra área. Se mide así:
   * de las que pueden con todo lo elegido, la que menos servicios de la
   * OTRA área sabe hacer.
   */
  const sugerida = useMemo(() => {
    if (eligibleSpecialists.length <= 1) return eligibleSpecialists[0] ?? null;
    const areasElegidas = new Set(selected.map((s) => areaDe(s.categoryKind)));
    const otraArea = services.filter((s) => !areasElegidas.has(areaDe(s.categoryKind)));
    let mejor = eligibleSpecialists[0];
    let peso = Number.POSITIVE_INFINITY;
    for (const e of eligibleSpecialists) {
      const p = otraArea.filter((s) => e.serviceIds.includes(s.id)).length;
      if (p < peso) {
        mejor = e;
        peso = p;
      }
    }
    return mejor;
  }, [eligibleSpecialists, selected, services]);

  // Si la elegida deja de poder hacer todo lo seleccionado, la corregimos
  // durante el render en vez de guardar un estado que habría que sincronizar.
  const activeSpecialistId = lockedSpecialistId
    ? lockedSpecialistId
    : specialistId && eligibleSpecialists.some((s) => s.id === specialistId)
      ? specialistId
      : (sugerida?.id ?? null);

  // El paso "con quién" se muestra siempre que haya equipo y algo elegido:
  // aunque no haya nada que decidir, la clienta quiere saber quién la
  // atiende. Solo desaparece si el estudio es de una sola persona.
  const preguntaQuien =
    !lockedSpecialistId && specialists.length > 1 && selected.length > 0;

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
    serviceIds.length > 0 && Boolean(time) && (Boolean(activeSpecialistId) || reparto !== null);

  const handleToggle = (id: string) => {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const seguir = () => setPasoIndex(Math.min(indice + 1, pasos.length - 1));
  const volver = () => setPasoIndex(Math.max(indice - 1, 0));

  const handleSubmit = async () => {
    if (!ready || !time) return;
    await onSubmit({
      serviceIds,
      specialistId: activeSpecialistId,
      day,
      time,
      note: note.trim(),
      referenceUrl,
    });
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
              Llevas de las dos áreas: van las dos, cada quien lo suyo.
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
              {eligibleSpecialists.length === 1
                ? "Esto lo lleva ella."
                : "Ya viene elegida quien se dedica a esto. Puedes cambiarla."}
            </p>
          </header>
          <div className="grid gap-2 sm:grid-cols-2">
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
          <DayPicker
            value={day}
            onChange={setDay}
            startDay={today}
            minDay={today}
            maxDay={maxDay}
            closedWeekdays={closedWeekdays}
          />
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
                <span className="block text-sm font-medium">
                  ¿Quieres dejar una nota o un diseño?
                </span>
                <span className="text-muted-foreground block text-xs">
                  Opcional · la foto de lo que quieres, o algo que debamos saber
                </span>
              </span>
              <ChevronDown
                className={cn("text-muted-foreground size-5 transition", noteOpen && "rotate-180")}
              />
            </button>
            {noteOpen ? (
              <div className="mt-2 space-y-4">
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ej.: quiero francesa con dorado"
                  rows={3}
                  maxLength={400}
                />
                {/* El diseño solo se ofrece si permiten subir cosas: en el
                    panel y en la agenda de la especialista la cita la escribe
                    el equipo, que ya sabe lo que va. */}
                {permiteDiseno ? (
                  <div>
                    <p className="mb-2 text-sm font-medium">¿Tienes un diseño en mente?</p>
                    <CampoDiseno value={referenceUrl} onChange={setReferenceUrl} />
                  </div>
                ) : null}
              </div>
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

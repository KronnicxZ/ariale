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
import { fetchDiasAction, fetchSlotsAction } from "@/actions/appointments";
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
  /**
   * Cuando cada especialista atiende en su propio día y hora. Si viene, manda
   * sobre `day`, `time` y `specialistId`, que se rellenan con el primer
   * grupo solo para que las pantallas viejas sigan teniendo algo que leer.
   */
  grupos?: GrupoReserva[];
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
  /**
   * Si la clienta elige especialista. En el panel y en la agenda sí: el
   * equipo agenda a nombre de quien sea. En la zona pública no, porque el
   * reparto es fijo —depilación es de Arianny, uñas y pies de Alejandra— y
   * preguntar por algo que no se decide solo añade un paso.
   */
  elegirEspecialista?: boolean;
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

/**
 * Un paso del asistente. `grupo` solo aparece cuando la cita se parte entre
 * las dos y la clienta pidió que cada una la atienda por su lado: entonces
 * hay un "día" y una "hora" por cada especialista.
 */
type Paso = { tipo: PasoId; grupo?: number };

/** Lo que la clienta reserva con una especialista: sus servicios, su hora. */
export type GrupoReserva = {
  specialistId: string;
  serviceIds: string[];
  day: string;
  time: string;
};

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
  elegirEspecialista = true,
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

  // Este paso solo sale cuando hay algo que decidir de verdad: o el equipo
  // está eligiendo a quién le toca, o la cita mezcla las dos áreas y hay
  // que decir si viene una vez o dos. Si no, sobra.
  const preguntaQuien =
    !lockedSpecialistId &&
    selected.length > 0 &&
    (reparto !== null || (elegirEspecialista && specialists.length > 1));

  /**
   * Cuando la cita se parte entre las dos: `false` es lo de siempre —las dos
   * a la misma hora, que es lo cómodo cuando se puede— y `true` es cada una
   * en su día y a su hora, para quien prefiere venir dos veces.
   */
  const [porSeparado, setPorSeparado] = useState(false);

  /**
   * La combinación de servicios para la que se comprobó que las dos NO
   * coinciden libres ningún día. Se guarda la combinación y no un booleano
   * para que, al cambiar de servicios, deje de valer sola.
   */
  const [sinDiasJuntas, setSinDiasJuntas] = useState<string | null>(null);
  const claveServicios = serviceIds.join(",");
  const juntasImposible = Boolean(reparto) && sinDiasJuntas === claveServicios;

  // Si no hay un solo día con las dos a la vez, ir por separado deja de ser
  // una preferencia y pasa a ser la única forma de reservar.
  const separadas = Boolean(reparto) && (porSeparado || juntasImposible);

  /**
   * El día y la hora de cada especialista cuando van por separado. Va por id
   * y no por posición en el reparto: si la clienta añade o quita un servicio,
   * el reparto se recalcula y una lista posicional se desalinearía sola.
   * Lo que sobra aquí simplemente no se lee.
   */
  /**
   * Los días con al menos un hueco. `null` mientras no se sabe, para no
   * apagar medio calendario antes de que llegue la respuesta.
   */
  const [diasConHueco, setDiasConHueco] = useState<Set<string> | null>(null);
  const [buscandoDias, startBuscarDias] = useTransition();

  const [porEspecialista, setPorEspecialista] = useState<
    Record<string, { day: string; time: string | null }>
  >({});
  const agenda = (reparto ?? []).map(
    (g) => porEspecialista[g.specialist.id] ?? { day: today, time: null },
  );

  const pasos = useMemo<Paso[]>(() => {
    const inicio: Paso[] = preguntaQuien
      ? [{ tipo: "servicio" }, { tipo: "quien" }]
      : [{ tipo: "servicio" }];
    if (!separadas) return [...inicio, { tipo: "dia" }, { tipo: "hora" }];
    return [
      ...inicio,
      ...(reparto ?? []).flatMap((_, i) => [
        { tipo: "dia" as const, grupo: i },
        { tipo: "hora" as const, grupo: i },
      ]),
    ];
  }, [preguntaQuien, separadas, reparto]);

  const [pasoIndex, setPasoIndex] = useState(() =>
    initial?.time ? Number.MAX_SAFE_INTEGER : 0,
  );
  const indice = Math.min(pasoIndex, pasos.length - 1);
  const paso = pasos[indice];
  const esUltimo = indice === pasos.length - 1;

  /**
   * Cuántos días admiten a las dos a la vez. Solo tiene sentido en el paso
   * de "¿Una visita o dos?", que es donde se pregunta por la cita entera sin
   * especialista fija —y eso es justo la intersección de las dos agendas.
   */
  const diasJuntas =
    paso?.tipo === "quien" && reparto && !porSeparado && diasConHueco
      ? diasConHueco.size
      : null;

  // El grupo que se está agendando ahora mismo, si van por separado.
  const grupoActivo = paso.grupo;
  const repartoActivo = grupoActivo === undefined ? null : (reparto?.[grupoActivo] ?? null);
  const agendaActiva = grupoActivo === undefined ? null : (agenda[grupoActivo] ?? null);

  /** El día y la hora que está tocando la clienta en este paso. */
  const diaGuardado = agendaActiva ? agendaActiva.day : day;
  const primeroConHueco = diasConHueco && diasConHueco.size > 0 ? [...diasConHueco][0] : null;
  const diaActual =
    diasConHueco && !diasConHueco.has(diaGuardado) && primeroConHueco
      ? primeroConHueco
      : diaGuardado;
  const horaActual = agendaActiva ? agendaActiva.time : time;
  const ponerDia = (nuevo: string) => {
    if (!repartoActivo) return setDay(nuevo);
    const id = repartoActivo.specialist.id;
    setPorEspecialista((prev) => ({ ...prev, [id]: { day: nuevo, time: null } }));
  };
  const ponerHora = (nueva: string | null) => {
    if (!repartoActivo) return setTime(nueva);
    const id = repartoActivo.specialist.id;
    setPorEspecialista((prev) => ({
      ...prev,
      [id]: { day: prev[id]?.day ?? today, time: nueva },
    }));
  };

  // Los servicios y la duración del paso: los del grupo si van por separado,
  // los de toda la cita si van juntas.
  const serviciosDelPaso = repartoActivo
    ? repartoActivo.services.map((x) => x.id)
    : serviceIds;
  const minutosDelPaso = repartoActivo
    ? repartoActivo.services.reduce((suma, x) => suma + x.durationMin, 0)
    : totalMinutes;

  // Cada vez que cambia lo que afecta la duración o el día, repreguntamos los
  // huecos al servidor. `requestId` descarta respuestas que llegan tarde.
  /** Vacío cuando el paso no es de un grupo: sirve para distinguir los casos. */
  const idEspecialistaDelPaso = repartoActivo ? repartoActivo.specialist.id : null;
  const especialistaDelPaso = idEspecialistaDelPaso ?? activeSpecialistId;
  const clavePaso = serviciosDelPaso.join(",");

  /**
   * Qué días tienen hueco para lo elegido. Se pregunta una vez por
   * combinación de servicios, no por día: el calendario los necesita todos a
   * la vez para poder apagar los que no sirven.
   *
   * Sin esto, entrar de noche dejaba hoy marcado, el salón ya cerrado y el
   * paso de la hora en blanco. Que es lo que le pasó a una clienta.
   */
  /** La consulta en curso pregunta por las dos juntas, no por un grupo. */
  const esConsultaJunta = Boolean(reparto) && !repartoActivo && especialistaDelPaso === null;
  const peticionDias = useRef(0);
  useEffect(() => {
    // Sin servicios no hay nada que preguntar. Tampoco hace falta limpiar:
    // al paso del día no se llega sin haber elegido algo.
    if (serviciosDelPaso.length === 0) return;
    const id = ++peticionDias.current;
    startBuscarDias(async () => {
      try {
        const r = await fetchDiasAction({
          desde: today,
          hasta: maxDay ?? today,
          serviceIds: serviciosDelPaso,
          specialistId: especialistaDelPaso,
        });
        if (id !== peticionDias.current) return;
        setDiasConHueco(new Set(r.dias));
        // Cuando la pregunta era por la cita entera y sin especialista fija,
        // la respuesta ES la coincidencia de las dos agendas.
        if (esConsultaJunta) setSinDiasJuntas(r.dias.length === 0 ? claveServicios : null);
      } catch {
        // Si falla, mejor un calendario entero abierto que uno todo apagado.
        if (id === peticionDias.current) setDiasConHueco(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavePaso, especialistaDelPaso, today, maxDay, esConsultaJunta]);

  useEffect(() => {
    if (serviciosDelPaso.length === 0) return;
    const id = ++requestId.current;
    startLoadingSlots(async () => {
      const result = await fetchSlotsAction({
        day: diaActual,
        serviceIds: serviciosDelPaso,
        specialistId: especialistaDelPaso,
      });
      if (id !== requestId.current) return;
      setSlots(result.slots);
      setSlotReason(result.reason);
      // Si la hora elegida ya no está libre, se suelta en vez de reservar a
      // ciegas un hueco que se acaba de ocupar.
      const sigueLibre = (h: string | null) =>
        h && result.slots.some((x) => x.time === h) ? h : null;
      if (!idEspecialistaDelPaso) {
        setTime(sigueLibre);
      } else {
        setPorEspecialista((prev) => {
          const actual = prev[idEspecialistaDelPaso];
          if (!actual?.time) return prev;
          const libre = sigueLibre(actual.time);
          if (libre === actual.time) return prev;
          return { ...prev, [idEspecialistaDelPaso]: { ...actual, time: libre } };
        });
      }
    });
    // `clavePaso` en vez del array: cambia de identidad en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaActual, clavePaso, especialistaDelPaso, idEspecialistaDelPaso]);

  // Al cambiar de paso, arriba del todo: en el teléfono el paso anterior
  // pudo dejar la página a media altura.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [indice]);

  const visibleSlots = serviceIds.length === 0 ? [] : slots;

  const puedeSeguir =
    paso.tipo === "servicio"
      ? serviceIds.length > 0
      : paso.tipo === "hora"
        ? Boolean(horaActual)
        : true;
  const ready = separadas
    ? agenda.length === (reparto?.length ?? 0) && agenda.every((g) => Boolean(g.time))
    : serviceIds.length > 0 &&
      Boolean(time) &&
      (Boolean(activeSpecialistId) || reparto !== null);

  const handleToggle = (id: string) => {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const seguir = () => setPasoIndex(Math.min(indice + 1, pasos.length - 1));
  const volver = () => setPasoIndex(Math.max(indice - 1, 0));

  const handleSubmit = async () => {
    if (!ready) return;

    if (separadas && reparto) {
      const grupos: GrupoReserva[] = reparto.map((g, i) => ({
        specialistId: g.specialist.id,
        serviceIds: g.services.map((x) => x.id),
        day: agenda[i].day,
        time: agenda[i].time!,
      }));
      // `day`/`time`/`specialistId` llevan los del primer grupo: no se usan
      // cuando hay `grupos`, pero así el resultado nunca queda a medias.
      await onSubmit({
        serviceIds,
        specialistId: grupos[0].specialistId,
        day: grupos[0].day,
        time: grupos[0].time,
        note: note.trim(),
        referenceUrl,
        grupos,
      });
      return;
    }

    if (!time) return;
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
        : paso.tipo === "hora"
          ? `${fmtDuration(totalMinutes)} · elige la hora`
          : fmtDuration(totalMinutes);

  return (
    <div className="pb-40" ref={topRef}>
      {/* Indicador: los pasos ya hechos se pueden tocar para volver. */}
      <ol className="mb-6 flex gap-2">
        {pasos.map((paso, i) => {
          const p = paso.tipo;
          const hecho = i < indice;
          const actual = i === indice;
          return (
            <li key={`${p}-${paso.grupo ?? ""}`} className="min-w-0 flex-1">
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
                <span className="truncate">
                  {paso.grupo !== undefined
                    ? `${ETIQUETA[p]} · ${reparto?.[paso.grupo]?.specialist.name ?? ""}`
                    : p === "quien" && reparto
                      ? "Cómo"
                      : ETIQUETA[p]}
                </span>
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

      {paso.tipo === "servicio" ? (
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

      {paso.tipo === "quien" && reparto ? (
        <section className="space-y-3">
          <header>
            <h2 className="font-display text-2xl font-semibold">¿Una visita o dos?</h2>
            <p className="text-muted-foreground text-sm">
              Llevas de las dos áreas, así que te atienden las dos.
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
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                [
                  false,
                  "A la misma hora",
                  "Vienes una vez y te atienden las dos a la vez.",
                  // Con las dos a la vez hacen falta dos agendas libres al
                  // mismo tiempo, así que quedan bastantes menos días. Se
                  // dice aquí, antes de elegir, y no después en un calendario
                  // medio apagado.
                  juntasImposible
                    ? "No coinciden libres ningún día."
                    : diasJuntas === null
                      ? null
                      : `${diasJuntas} ${diasJuntas === 1 ? "día" : "días"} con las dos a la vez.`,
                  juntasImposible,
                ],
                [
                  true,
                  "Cada una por su lado",
                  "Eliges día y hora para cada una. Vienes dos veces.",
                  juntasImposible
                    ? "La única forma de reservar esto."
                    : diasJuntas !== null && diasJuntas < 5
                      ? "Más días para elegir."
                      : null,
                  false,
                ],
              ] as const
            ).map(([valor, titulo, detalle, aviso, apagado]) => (
              <button
                key={String(valor)}
                type="button"
                disabled={apagado}
                onClick={() => setPorSeparado(valor)}
                className={cn(
                  "rounded-2xl border px-4 py-3.5 text-left transition",
                  apagado
                    ? "border-border bg-muted/40 cursor-not-allowed opacity-70"
                    : porSeparado === valor
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50",
                )}
              >
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    porSeparado === valor && !apagado && "text-primary",
                  )}
                >
                  {titulo}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs">{detalle}</span>
                {aviso ? (
                  <span
                    className={cn(
                      "mt-1.5 block text-xs font-medium",
                      apagado ? "text-muted-foreground" : "text-primary",
                    )}
                  >
                    {aviso}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {paso.tipo === "quien" && !reparto && elegirEspecialista ? (
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

      {paso.tipo === "dia" ? (
        <section className="space-y-3">
          <header>
            <h2 className="font-display text-2xl font-semibold">
              {repartoActivo ? `El día con ${repartoActivo.specialist.name}` : "Elige el día"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {repartoActivo
                ? `${repartoActivo.services.map((x) => x.name).join(" + ")} · ${fmtDuration(minutosDelPaso)}`
                : `La cita dura ${fmtDuration(totalMinutes)}.`}
              {diasConHueco && diasConHueco.size > 0
                ? " Los días apagados están llenos o cerrados."
                : ""}
            </p>
          </header>
          <DayPicker
            value={diaActual}
            onChange={ponerDia}
            startDay={today}
            minDay={today}
            maxDay={maxDay}
            closedWeekdays={closedWeekdays}
            openDays={diasConHueco}
            loading={buscandoDias}
          />
        </section>
      ) : null}

      {paso.tipo === "hora" ? (
        <>
          <section className="space-y-3">
            <header>
              <h2 className="font-display text-2xl font-semibold">
                {repartoActivo ? `La hora con ${repartoActivo.specialist.name}` : "Elige la hora"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {horaActual ? (
                  <>
                    Te esperamos a las <strong>{prettyTime(horaActual)}</strong> · termina ~
                    {fmtDuration(minutosDelPaso)} después.
                  </>
                ) : (
                  "Solo se muestran las horas donde de verdad hay sitio."
                )}
              </p>
            </header>
            <SlotPicker
              slots={visibleSlots}
              value={horaActual}
              onChange={ponerHora}
              loading={loadingSlots}
              emptyMessage={slotReason}
            />
          </section>

          <section className={cn("mt-6", !esUltimo && "hidden")}>
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

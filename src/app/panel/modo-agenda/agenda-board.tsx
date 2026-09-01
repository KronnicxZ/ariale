"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useClock } from "@/hooks/use-clock";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { DAY_SHORT } from "@/lib/date";
import { formatUsd } from "@/lib/money";

type Appointment = {
  id: string;
  specialistId: string;
  startAt: string;
  endAt: string;
  status: string;
  note: string | null;
  clientName: string;
  services: string[];
  totalCents: number;
};

type Specialist = { id: string; name: string; color: string; slug: string };

type Props = {
  day: string;
  today: string;
  strip: { day: string; dayOfWeek: number; dayNumber: number; month: string; count: number }[];
  counts: { total: number; pending: number; confirmed: number; attended: number };
  specialists: Specialist[];
  specialistId?: string;
  openTime: string;
  closeTime: string;
  closed: boolean;
  timezone: string;
  appointments: Appointment[];
};

const ROW_HEIGHT = 64; // px por hora

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function label(hour: number) {
  const suffix = hour < 12 ? "am" : "pm";
  const value = hour % 12 === 0 ? 12 : hour % 12;
  return `${value}:00 ${suffix}`;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "border-warning/60 bg-warning/10",
  CONFIRMED: "border-success/50 bg-success/10",
  ATTENDED: "border-primary/50 bg-primary/10",
  CANCELLED: "border-border bg-muted opacity-55",
  NO_SHOW: "border-destructive/40 bg-destructive/8 opacity-70",
};

/**
 * Vista de tablero: una columna por especialista y las citas colocadas por
 * hora, como el "modo agenda" del sistema original. Pensada para dejarla
 * abierta en la tablet del salón.
 */
export function AgendaBoard({
  day,
  today,
  strip,
  counts,
  specialists,
  specialistId,
  openTime,
  closeTime,
  closed,
  timezone,
  appointments,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [fullscreen, setFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reloj en vivo, como el de la pantalla del salón.
  const tick = useClock(30_000);
  const now = tick == null ? null : new Date(tick);

  const visible = specialistId ? specialists.filter((s) => s.id === specialistId) : specialists;

  const startMin = Math.min(toMinutes(openTime), 8 * 60);
  const endMin = Math.max(toMinutes(closeTime), 19 * 60);
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = Math.floor(startMin / 60); h <= Math.ceil(endMin / 60); h++) list.push(h);
    return list;
  }, [startMin, endMin]);

  const localMinutes = (iso: string) => {
    const parts = new Intl.DateTimeFormat("es-VE", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(iso));
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return h * 60 + m;
  };

  const nowMinutes = now && day === today ? localMinutes(now.toISOString()) : null;
  const nowOffset =
    nowMinutes != null && nowMinutes >= startMin && nowMinutes <= endMin
      ? ((nowMinutes - startMin) / 60) * ROW_HEIGHT
      : null;

  // Al abrir, centramos la vista en la hora actual.
  useEffect(() => {
    if (nowOffset != null && scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, nowOffset - 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (target: string) => {
    const next = new URLSearchParams(params);
    next.set("dia", target);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const shift = (amount: number) => {
    const [y, m, d] = day.split("-").map(Number);
    goTo(new Date(Date.UTC(y, m - 1, d + amount)).toISOString().slice(0, 10));
  };

  const setSpecialist = (value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("especialista", value);
    else next.delete("especialista");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const dayLabel = new Date(`${day}T12:00:00Z`).toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  const clock = now
    ? new Intl.DateTimeFormat("es-VE", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now)
    : "";

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        fullscreen && "bg-background fixed inset-0 z-50 overflow-auto p-4",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="surface-sm border-border hover:bg-accent grid size-9 place-items-center transition"
            aria-label="Día anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div>
            <p className="text-muted-foreground text-[0.7rem] tracking-widest uppercase">
              Modo agenda
            </p>
            <h1 className="font-display text-xl leading-tight font-semibold capitalize">
              {dayLabel}
            </h1>
            <p className="text-muted-foreground text-xs">
              {counts.total} {counts.total === 1 ? "cita" : "citas"} ·{" "}
              {specialists.length} {specialists.length === 1 ? "especialista" : "especialistas"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => shift(1)}
            className="surface-sm border-border hover:bg-accent grid size-9 place-items-center transition"
            aria-label="Día siguiente"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {clock ? (
            <div className="surface-sm px-3 py-1.5 text-right">
              <p className="text-muted-foreground text-[0.6rem] tracking-widest uppercase">Hora</p>
              <p className="font-numeric text-lg leading-tight font-semibold tabular-nums">
                {clock}
              </p>
            </div>
          ) : null}
          <Link
            href="/panel/agenda/nueva"
            className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl transition hover:opacity-90"
            aria-label="Nueva cita"
          >
            <CalendarPlus className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setFullscreen((value) => !value)}
            className="surface-sm border-border hover:bg-accent grid size-9 place-items-center transition"
            aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          {fullscreen ? (
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="surface-sm border-border hover:bg-accent grid size-9 place-items-center transition"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Citas", value: counts.total },
          { label: "Pendientes", value: counts.pending },
          { label: "Confirmadas", value: counts.confirmed },
          { label: "Atendidas", value: counts.attended },
        ].map((stat) => (
          <div key={stat.label} className="surface-sm px-3 py-2">
            <p className="text-muted-foreground text-[0.65rem] tracking-wide uppercase">
              {stat.label}
            </p>
            <p className="font-numeric text-lg font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
        {strip.map((entry) => (
          <button
            key={entry.day}
            type="button"
            onClick={() => goTo(entry.day)}
            className={cn(
              "flex w-16 shrink-0 flex-col items-center rounded-xl border py-1.5 transition",
              entry.day === day
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/50",
            )}
          >
            <span
              className={cn(
                "text-[0.62rem] uppercase",
                entry.day === day ? "text-primary-foreground/75" : "text-muted-foreground",
              )}
            >
              {entry.day === today ? "Hoy" : DAY_SHORT[entry.dayOfWeek]}
            </span>
            <span className="font-numeric text-base leading-tight font-semibold">
              {entry.dayNumber}
            </span>
            <span
              className={cn(
                "text-[0.6rem]",
                entry.day === day
                  ? "text-primary-foreground/70"
                  : entry.count > 0
                    ? "text-primary"
                    : "text-muted-foreground/60",
              )}
            >
              {entry.count > 0 ? `${entry.count} citas` : "Libre"}
            </span>
          </button>
        ))}
      </div>

      {specialists.length > 1 ? (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
          <button
            type="button"
            onClick={() => setSpecialist()}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition",
              !specialistId
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            Todo el equipo
          </button>
          {specialists.map((specialist) => (
            <button
              key={specialist.id}
              type="button"
              onClick={() => setSpecialist(specialist.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
                specialistId === specialist.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              <span className="size-2 rounded-full" style={{ background: specialist.color }} />
              {specialist.name}
            </button>
          ))}
        </div>
      ) : null}

      {closed ? (
        <p className="bg-muted/60 text-muted-foreground rounded-xl px-4 py-3 text-center text-sm">
          Ese día el estudio no atiende. Puedes agendar igual, pero revisa el horario en Mi
          negocio.
        </p>
      ) : null}

      <div className="surface overflow-hidden">
        {/* Cabecera de columnas */}
        <div className="bg-muted/40 flex border-b">
          <div className="w-16 shrink-0" />
          {visible.map((specialist) => {
            const count = appointments.filter(
              (a) =>
                a.specialistId === specialist.id &&
                a.status !== "CANCELLED" &&
                a.status !== "NO_SHOW",
            ).length;
            return (
              <div
                key={specialist.id}
                className="flex min-w-0 flex-1 items-center gap-2 border-l px-2 py-2"
              >
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full text-[0.65rem] font-semibold text-white"
                  style={{ background: specialist.color }}
                >
                  {initials(specialist.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{specialist.name}</span>
                  <span className="text-muted-foreground block text-[0.65rem]">
                    {count} {count === 1 ? "cita" : "citas"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Rejilla horaria */}
        <div
          ref={scrollRef}
          className="relative overflow-y-auto"
          style={{ maxHeight: fullscreen ? "calc(100dvh - 20rem)" : "32rem" }}
        >
          <div className="relative flex" style={{ height: hours.length * ROW_HEIGHT }}>
            <div className="w-16 shrink-0">
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  className="text-muted-foreground border-b pr-2 text-right text-[0.65rem]"
                  style={{ height: ROW_HEIGHT }}
                >
                  <span className="relative -top-1.5">{index === 0 ? "" : label(hour)}</span>
                </div>
              ))}
            </div>

            {visible.map((specialist) => (
              <div key={specialist.id} className="relative min-w-0 flex-1 border-l">
                {hours.map((hour) => (
                  <div key={hour} className="border-b" style={{ height: ROW_HEIGHT }} />
                ))}

                {appointments
                  .filter((a) => a.specialistId === specialist.id)
                  .map((appointment) => {
                    const start = localMinutes(appointment.startAt);
                    const end = localMinutes(appointment.endAt);
                    const top = ((start - startMin) / 60) * ROW_HEIGHT;
                    const height = Math.max((((end - start) / 60) * ROW_HEIGHT), 30);

                    return (
                      <Link
                        key={appointment.id}
                        href={`/panel/agenda/${appointment.id}`}
                        className={cn(
                          "absolute right-1 left-1 overflow-hidden rounded-lg border-l-4 px-2 py-1 transition hover:brightness-95",
                          STATUS_STYLES[appointment.status] ?? STATUS_STYLES.PENDING,
                        )}
                        style={{ top, height, borderLeftColor: specialist.color }}
                      >
                        <p className="truncate text-[0.72rem] leading-tight font-semibold">
                          {appointment.clientName}
                        </p>
                        <p className="text-muted-foreground truncate text-[0.65rem] leading-tight">
                          {appointment.services.join(" + ")}
                        </p>
                        {height > 52 ? (
                          <p className="text-muted-foreground truncate text-[0.62rem] tabular-nums">
                            {formatUsd(appointment.totalCents)}
                          </p>
                        ) : null}
                      </Link>
                    );
                  })}
              </div>
            ))}

            {nowOffset != null ? (
              <div
                className="pointer-events-none absolute right-0 left-14 z-10 flex items-center"
                style={{ top: nowOffset }}
              >
                <span className="bg-destructive size-2 shrink-0 rounded-full" />
                <span className="bg-destructive/60 h-px flex-1" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

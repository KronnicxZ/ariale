"use client";

import { useMemo, useRef } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAY_SHORT } from "@/lib/date";

/**
 * Carrusel horizontal de días, como en la app original: "Hoy 29 / Mañana 30 /
 * Lun 31…". En móvil se desliza con el pulgar; el input de fecha queda detrás
 * del botón de calendario para saltar lejos.
 */
export function DayPicker({
  value,
  onChange,
  days = 21,
  startDay,
  disabledDays,
  minDay,
  maxDay,
}: {
  value: string;
  onChange: (day: string) => void;
  days?: number;
  /** Día inicial en formato yyyy-MM-dd. Por defecto, hoy en el salón. */
  startDay: string;
  /** Días sin atención, en yyyy-MM-dd. */
  disabledDays?: Set<string>;
  minDay?: string;
  maxDay?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const [y, m, d] = startDay.split("-").map(Number);
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(Date.UTC(y, m - 1, d + i));
      const key = date.toISOString().slice(0, 10);
      return {
        key,
        dayOfWeek: date.getUTCDay(),
        dayNumber: date.getUTCDate(),
        month: date.toLocaleDateString("es-VE", { month: "short", timeZone: "UTC" }),
        offset: i,
      };
    });
  }, [startDay, days]);

  const label = (offset: number, dayOfWeek: number) => {
    if (offset === 0) return "Hoy";
    if (offset === 1) return "Mañana";
    return DAY_SHORT[dayOfWeek];
  };

  return (
    <div className="flex items-stretch gap-2">
      <div className="no-scrollbar snap-row -mx-1 flex flex-1 gap-2 overflow-x-auto px-1 py-1">
        {options.map((option) => {
          const disabled = disabledDays?.has(option.key);
          const active = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.key)}
              className={cn(
                "flex w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-2xl border py-2.5 transition",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : disabled
                    ? "border-border/60 bg-muted/40 text-muted-foreground/45 cursor-not-allowed"
                    : "border-border bg-card hover:border-primary/50",
              )}
            >
              <span
                className={cn(
                  "text-[0.68rem] font-medium",
                  active ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {label(option.offset, option.dayOfWeek)}
              </span>
              <span className="font-heading text-xl leading-tight font-semibold">
                {option.dayNumber}
              </span>
              <span
                className={cn(
                  "text-[0.65rem] capitalize",
                  active ? "text-primary-foreground/75" : "text-muted-foreground",
                )}
              >
                {option.month.replace(".", "")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => inputRef.current?.showPicker?.()}
          className="border-border bg-card hover:border-primary/50 flex h-full w-14 flex-col items-center justify-center gap-1 rounded-2xl border transition"
        >
          <CalendarDays className="text-muted-foreground size-4" />
          <span className="text-muted-foreground text-[0.6rem]">Otro día</span>
        </button>
        <input
          ref={inputRef}
          type="date"
          value={value}
          min={minDay}
          max={maxDay}
          onChange={(event) => event.target.value && onChange(event.target.value)}
          className="pointer-events-none absolute inset-0 size-full opacity-0"
          tabIndex={-1}
          aria-label="Elegir otra fecha"
        />
      </div>
    </div>
  );
}

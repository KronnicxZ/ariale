"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Calendario de mes, que es como se piensa una fecha: "el sábado 13", no "el
 * día 9 de la fila". Antes esto era un carrusel horizontal de días y había
 * que deslizarlo a ciegas para llegar a la semana siguiente.
 *
 * Todo se calcula en UTC a propósito. Los días viajan como "2026-09-04" y
 * son días del salón, no del navegador: si se usara la hora local, a alguien
 * en otro huso le saldría el día corrido.
 */

const DIAS_CABECERA = ["D", "L", "M", "M", "J", "V", "S"];

/** "2026-09-04" → Date en UTC, sin que el huso del navegador lo mueva. */
function aFecha(dia: string) {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function aClave(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

export function DayPicker({
  value,
  onChange,
  days = 60,
  startDay,
  disabledDays,
  closedWeekdays,
  minDay,
  maxDay,
}: {
  value: string;
  onChange: (day: string) => void;
  /** Hasta cuántos días adelante se puede reservar, contados desde hoy. */
  days?: number;
  /** Día inicial en formato yyyy-MM-dd. Por defecto, hoy en el salón. */
  startDay: string;
  /** Días sin atención, en yyyy-MM-dd. */
  disabledDays?: Set<string>;
  /** Días de la semana en que el estudio no abre (0 = domingo). */
  closedWeekdays?: number[];
  minDay?: string;
  maxDay?: string;
}) {
  // El primero de la ventana: nunca antes de hoy, aunque `minDay` diga otra
  // cosa, porque el pasado no se agenda.
  const desde = minDay && minDay > startDay ? minDay : startDay;
  const hasta = useMemo(() => {
    if (maxDay) return maxDay;
    const tope = aFecha(startDay);
    tope.setUTCDate(tope.getUTCDate() + days);
    return aClave(tope);
  }, [maxDay, startDay, days]);

  // El mes que se está mirando, como "2026-09". Arranca en el del día ya
  // elegido, para que al volver atrás en el asistente no se pierda.
  const [mes, setMes] = useState(() => (value || desde).slice(0, 7));

  const { celdas, titulo, hayAnterior, haySiguiente } = useMemo(() => {
    const [y, m] = mes.split("-").map(Number);
    const primero = new Date(Date.UTC(y, m - 1, 1));
    const diasDelMes = new Date(Date.UTC(y, m, 0)).getUTCDate();

    // Huecos hasta el primer día, para que caiga en su columna.
    const huecos: null[] = Array.from({ length: primero.getUTCDay() }, () => null);
    const dias = Array.from({ length: diasDelMes }, (_, i) => {
      const fecha = new Date(Date.UTC(y, m - 1, i + 1));
      const clave = aClave(fecha);
      return {
        clave,
        numero: i + 1,
        fuera: clave < desde || clave > hasta,
        cerrado:
          (disabledDays?.has(clave) ?? false) ||
          (closedWeekdays?.includes(fecha.getUTCDay()) ?? false),
      };
    });

    return {
      celdas: [...huecos, ...dias],
      titulo: primero.toLocaleDateString("es-VE", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      // Comparar cadenas "yyyy-MM-dd" funciona porque están rellenas a cero.
      hayAnterior: mes > desde.slice(0, 7),
      haySiguiente: mes < hasta.slice(0, 7),
    };
  }, [mes, desde, hasta, disabledDays, closedWeekdays]);

  const moverMes = (paso: number) => {
    const [y, m] = mes.split("-").map(Number);
    const nuevo = new Date(Date.UTC(y, m - 1 + paso, 1));
    setMes(aClave(nuevo).slice(0, 7));
  };

  return (
    <div className="surface-sm w-full p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => moverMes(-1)}
          disabled={!hayAnterior}
          aria-label="Mes anterior"
          className="hover:bg-muted disabled:text-muted-foreground/35 grid size-9 place-items-center rounded-full transition disabled:hover:bg-transparent"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-[15px] font-medium first-letter:uppercase">{titulo}</p>
        <button
          type="button"
          onClick={() => moverMes(1)}
          disabled={!haySiguiente}
          aria-label="Mes siguiente"
          className="hover:bg-muted disabled:text-muted-foreground/35 grid size-9 place-items-center rounded-full transition disabled:hover:bg-transparent"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="text-muted-foreground grid grid-cols-7 gap-1 text-center text-[0.7rem] font-medium">
        {DIAS_CABECERA.map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {celdas.map((celda, i) =>
          celda === null ? (
            <span key={`hueco-${i}`} />
          ) : (
            <button
              key={celda.clave}
              type="button"
              disabled={celda.fuera || celda.cerrado}
              onClick={() => onChange(celda.clave)}
              // Un día cerrado se tacha; uno fuera de la ventana solo se
              // apaga. No es lo mismo "ese día no abrimos" que "todavía no
              // se puede agendar tan lejos".
              className={cn(
                "font-numeric grid h-11 place-items-center rounded-xl text-sm transition sm:h-12",
                value === celda.clave
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : celda.fuera
                    ? "text-muted-foreground/30 cursor-not-allowed"
                    : celda.cerrado
                      ? "text-muted-foreground/40 cursor-not-allowed line-through"
                      : celda.clave === startDay
                        ? "border-primary/50 hover:bg-muted border font-semibold"
                        : "hover:bg-muted",
              )}
            >
              {celda.numero}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

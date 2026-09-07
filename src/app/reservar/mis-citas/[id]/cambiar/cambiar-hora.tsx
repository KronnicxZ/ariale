"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DayPicker } from "@/components/booking/day-picker";
import { SlotPicker, prettyTime, type SlotOption } from "@/components/booking/slot-picker";
import { fetchDiasAction, fetchSlotsAction } from "@/actions/appointments";
import { clientRescheduleAction } from "@/actions/client-zone";

/**
 * Día y hora, nada más.
 *
 * Es el mismo calendario del asistente, con la misma regla: los días sin
 * hueco salen apagados. La única diferencia es que esta cita no se cuenta a
 * sí misma como ocupada —si no, su propia hora saldría llena y no se podría
 * pasar de las tres a las cinco del mismo día.
 */
export function CambiarHora({
  id,
  serviceIds,
  specialistId,
  diaActual,
  today,
  maxDay,
  closedWeekdays,
}: {
  id: string;
  serviceIds: string[];
  specialistId: string;
  diaActual: string;
  today: string;
  maxDay: string;
  closedWeekdays: number[];
}) {
  const router = useRouter();
  const [day, setDay] = useState(diaActual < today ? today : diaActual);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [motivo, setMotivo] = useState<string | undefined>();
  const [dias, setDias] = useState<Set<string> | null>(null);
  const [cargandoDias, cargarDias] = useTransition();
  const [cargandoSlots, cargarSlots] = useTransition();
  const [guardando, guardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const peticion = useRef(0);

  useEffect(() => {
    cargarDias(async () => {
      const { dias } = await fetchDiasAction({
        desde: today,
        hasta: maxDay,
        serviceIds,
        specialistId,
        excluirCitaId: id,
      });
      setDias(new Set(dias));
    });
    // Los ids no cambian mientras esta pantalla está abierta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, maxDay, specialistId, id]);

  useEffect(() => {
    const mio = ++peticion.current;
    cargarSlots(async () => {
      const resultado = await fetchSlotsAction({
        day,
        serviceIds,
        specialistId,
        excludeAppointmentId: id,
      });
      if (mio !== peticion.current) return;
      setSlots(resultado.slots);
      setMotivo(resultado.reason);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, specialistId, id]);

  return (
    <div className="space-y-6">
      <DayPicker
        value={day}
        // La hora elegida se olvida aquí y no en el efecto: cambiar de día
        // es algo que hace la clienta, no algo que sincronizar al pintar.
        onChange={(d) => {
          setDay(d);
          setTime(null);
        }}
        startDay={today}
        minDay={today}
        maxDay={maxDay}
        closedWeekdays={closedWeekdays}
        openDays={dias}
        loading={cargandoDias}
      />

      <div>
        <p className="mb-2 text-sm font-semibold">Hora</p>
        <SlotPicker
          slots={slots}
          value={time}
          onChange={setTime}
          loading={cargandoSlots}
          emptyMessage={motivo ?? "Ese día ya no queda hueco."}
        />
      </div>

      {error ? (
        <p className="text-destructive flex items-start gap-1.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button
        className="h-12 w-full text-base"
        disabled={!time || guardando}
        onClick={() => {
          if (!time) return;
          setError(null);
          guardar(async () => {
            const salida = await clientRescheduleAction({ id, day, time });
            if (salida.ok) {
              router.push("/reservar/mis-citas");
              router.refresh();
            } else {
              setError(salida.error);
            }
          });
        }}
      >
        {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
        {time ? `Mover a las ${prettyTime(time)}` : "Elige una hora"}
      </Button>
    </div>
  );
}

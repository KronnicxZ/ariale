"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DayPicker } from "@/components/booking/day-picker";
import { SlotPicker, type SlotOption } from "@/components/booking/slot-picker";
import { fetchSlotsAction, rescheduleAppointmentAction } from "@/actions/appointments";

export function RescheduleDialog({
  appointmentId,
  serviceIds,
  specialistId,
  today,
}: {
  appointmentId: string;
  serviceIds: string[];
  specialistId: string;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(today);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [reason, setReason] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    if (!open) return;
    startLoading(async () => {
      const result = await fetchSlotsAction({
        day,
        serviceIds,
        specialistId,
        excludeAppointmentId: appointmentId,
      });
      setSlots(result.slots);
      setReason(result.reason);
      setTime(null);
    });
  }, [open, day, serviceIds, specialistId, appointmentId]);

  const save = () => {
    if (!time) return;
    setError(null);
    startSaving(async () => {
      const formData = new FormData();
      formData.set("id", appointmentId);
      formData.set("day", day);
      formData.set("time", time);
      const result = await rescheduleAppointmentAction(null, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 w-full">
          <CalendarClock className="size-4" />
          Mover
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mover la cita</DialogTitle>
          <DialogDescription>
            Elige el nuevo día y hora. Se respeta la duración del servicio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <DayPicker value={day} onChange={setDay} startDay={today} minDay={today} />
          <SlotPicker
            slots={slots}
            value={time}
            onChange={setTime}
            loading={loading}
            emptyMessage={reason}
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button onClick={save} disabled={!time || saving} className="h-11 w-full">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar cambio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

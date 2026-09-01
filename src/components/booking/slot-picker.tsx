"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SlotOption = { time: string; period: "morning" | "afternoon" | "evening" };

const PERIOD_LABELS = {
  morning: "Mañana",
  afternoon: "Tarde",
  evening: "Noche",
} as const;

const ORDER: SlotOption["period"][] = ["morning", "afternoon", "evening"];

/** "14:30" -> "2:30 pm" */
function pretty(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function SlotPicker({
  slots,
  value,
  onChange,
  loading,
  emptyMessage,
}: {
  slots: SlotOption[];
  value: string | null;
  onChange: (time: string) => void;
  loading?: boolean;
  emptyMessage?: string;
}) {
  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Buscando horarios…
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="text-muted-foreground bg-muted/50 rounded-xl px-4 py-5 text-center text-sm">
        {emptyMessage ?? "Ese día no queda un hueco de esa duración. Prueba otro."}
      </p>
    );
  }

  const groups = ORDER.map((period) => ({
    period,
    items: slots.filter((s) => s.period === period),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.period} className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
            {PERIOD_LABELS[group.period]}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {group.items.map((slot) => (
              <button
                key={slot.time}
                type="button"
                onClick={() => onChange(slot.time)}
                className={cn(
                  "rounded-xl border px-2 py-2.5 text-sm font-medium tabular-nums transition",
                  value === slot.time
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card hover:border-primary/50 active:scale-95",
                )}
              >
                {pretty(slot.time)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export { pretty as prettyTime };

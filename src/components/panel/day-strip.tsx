"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAY_SHORT } from "@/lib/date";

type Day = {
  day: string;
  dayOfWeek: number;
  dayNumber: number;
  month: string;
  count: number;
};

/** Tira de días con el número de citas de cada uno, como el modo agenda. */
export function DayStrip({
  days,
  current,
  today,
}: {
  days: Day[];
  current: string;
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const goTo = (day: string) => {
    const next = new URLSearchParams(params);
    next.set("dia", day);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const shift = (amount: number) => {
    const [y, m, d] = current.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + amount));
    goTo(date.toISOString().slice(0, 10));
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => shift(-1)}
        className="border-border bg-card hover:bg-accent grid size-9 shrink-0 place-items-center rounded-xl border transition"
        aria-label="Día anterior"
      >
        <ChevronLeft className="size-4" />
      </button>

      <div className="no-scrollbar snap-row flex flex-1 gap-2 overflow-x-auto py-1">
        {days.map((entry) => {
          const active = entry.day === current;
          const isToday = entry.day === today;
          return (
            <button
              key={entry.day}
              type="button"
              onClick={() => goTo(entry.day)}
              className={cn(
                "relative flex w-16 shrink-0 flex-col items-center justify-center rounded-2xl border py-2 transition",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card hover:border-primary/50",
              )}
            >
              <span
                className={cn(
                  "text-[0.65rem] font-medium uppercase",
                  active ? "text-primary-foreground/75" : "text-muted-foreground",
                )}
              >
                {isToday ? "Hoy" : DAY_SHORT[entry.dayOfWeek]}
              </span>
              <span className="font-heading text-lg leading-tight font-semibold">
                {entry.dayNumber}
              </span>
              <span
                className={cn(
                  "text-[0.62rem]",
                  active
                    ? "text-primary-foreground/70"
                    : entry.count > 0
                      ? "text-primary font-medium"
                      : "text-muted-foreground/60",
                )}
              >
                {entry.count > 0 ? `${entry.count} cita${entry.count === 1 ? "" : "s"}` : "Libre"}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => shift(1)}
        className="border-border bg-card hover:bg-accent grid size-9 shrink-0 place-items-center rounded-xl border transition"
        aria-label="Día siguiente"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

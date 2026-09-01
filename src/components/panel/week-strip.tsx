import Link from "next/link";
import { DAY_SHORT } from "@/lib/date";
import { cn } from "@/lib/utils";

type Day = {
  day: string;
  dayOfWeek: number;
  dayNumber: number;
  month: string;
  count: number;
};

/**
 * Los próximos días con su número de citas. Enlaza a la agenda, así que en
 * móvil basta un toque para saltar de día sin abrir ningún menú.
 */
export function WeekStrip({ days, today }: { days: Day[]; today: string }) {
  return (
    <div className="no-scrollbar snap-row -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      {days.map((entry) => {
        const isToday = entry.day === today;
        return (
          <Link
            key={entry.day}
            href={`/panel/agenda?dia=${entry.day}`}
            className={cn(
              "flex w-[4.25rem] shrink-0 flex-col items-center rounded-2xl py-2.5 transition",
              isToday
                ? "bg-primary text-primary-foreground shadow-sm"
                : "surface-sm hover:border-primary/40",
            )}
          >
            <span
              className={cn(
                "text-[0.62rem] font-semibold tracking-wide uppercase",
                isToday ? "text-primary-foreground/75" : "text-muted-foreground",
              )}
            >
              {isToday ? "Hoy" : DAY_SHORT[entry.dayOfWeek]}
            </span>
            <span className="font-numeric text-xl leading-tight">{entry.dayNumber}</span>
            <span
              className={cn(
                "text-[0.62rem]",
                isToday
                  ? "text-primary-foreground/75"
                  : entry.count > 0
                    ? "text-primary font-medium"
                    : "text-muted-foreground/60",
              )}
            >
              {entry.count > 0 ? `${entry.count} cita${entry.count === 1 ? "" : "s"}` : "Libre"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

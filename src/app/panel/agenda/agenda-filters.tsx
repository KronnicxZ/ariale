"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABELS } from "@/components/panel/status-badge";

type Specialist = { id: string; name: string; color: string };

/** Filtros por especialista y estado, sincronizados con la URL. */
export function AgendaFilters({
  specialists,
  specialistId,
  status,
}: {
  specialists: Specialist[];
  specialistId?: string;
  status?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const pill = (active: boolean) =>
    cn(
      "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
      active
        ? "bg-primary text-primary-foreground"
        : "bg-secondary text-secondary-foreground hover:bg-accent",
    );

  return (
    <div className="space-y-2">
      {specialists.length > 1 ? (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
          <button
            type="button"
            onClick={() => setParam("especialista")}
            className={pill(!specialistId)}
          >
            Todo el equipo
          </button>
          {specialists.map((specialist) => (
            <button
              key={specialist.id}
              type="button"
              onClick={() => setParam("especialista", specialist.id)}
              className={cn(pill(specialistId === specialist.id), "flex items-center gap-1.5")}
            >
              <span className="size-2 rounded-full" style={{ background: specialist.color }} />
              {specialist.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
        <button type="button" onClick={() => setParam("estado")} className={pill(!status)}>
          Todas
        </button>
        {(["PENDING", "CONFIRMED", "ATTENDED", "CANCELLED"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setParam("estado", value)}
            className={pill(status === value)}
          >
            {APPOINTMENT_STATUS_LABELS[value]}
          </button>
        ))}
      </div>
    </div>
  );
}

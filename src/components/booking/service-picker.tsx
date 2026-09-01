"use client";

import { Check, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBs, formatUsd } from "@/lib/money";
import { fmtDuration } from "@/lib/date";
import type { ServiceOption } from "@/components/booking/types";

/**
 * Selección múltiple de servicios agrupada por categoría. Las duraciones se
 * suman, que es lo que espera la manicurista cuando combina dos servicios.
 */
export function ServicePicker({
  services,
  selected,
  onToggle,
  rate,
  packageServiceIds,
}: {
  services: ServiceOption[];
  selected: string[];
  onToggle: (id: string) => void;
  rate?: number;
  /** Servicios cubiertos por un bono con saldo. */
  packageServiceIds?: Set<string>;
}) {
  const groups = new Map<string, { name: string; color: string; items: ServiceOption[] }>();
  for (const service of services) {
    const group = groups.get(service.categoryId) ?? {
      name: service.categoryName,
      color: service.categoryColor,
      items: [],
    };
    group.items.push(service);
    groups.set(service.categoryId, group);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([categoryId, group]) => (
        <div key={categoryId} className="space-y-2">
          <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <span className="size-2 rounded-full" style={{ background: group.color }} />
            {group.name}
          </p>

          <div className="space-y-2">
            {group.items.map((service) => {
              const isSelected = selected.includes(service.id);
              const covered = packageServiceIds?.has(service.id);

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onToggle(service.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                    isSelected
                      ? "border-primary bg-primary/8 ring-primary/25 ring-1"
                      : "border-border bg-card hover:border-primary/40 active:scale-[0.995]",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border-2 transition",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {isSelected ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{service.name}</span>
                      {covered ? (
                        <span className="bg-success/12 text-success rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold">
                          Con tu bono
                        </span>
                      ) : null}
                      {service.requiresPatchTest ? (
                        <ShieldAlert className="text-warning size-3.5" aria-label="Requiere prueba de sensibilidad" />
                      ) : null}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {fmtDuration(service.durationMin)}
                      {service.bodyZone ? ` · ${service.bodyZone}` : ""}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      {formatUsd(service.priceCents)}
                    </span>
                    {rate ? (
                      <span className="text-muted-foreground block text-[0.7rem] tabular-nums">
                        {formatBs(service.priceCents, rate)}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PeriodPreset } from "@/lib/date";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "last7", label: "7 días" },
  { value: "last30", label: "30 días" },
  { value: "month", label: "Este mes" },
  { value: "last-month", label: "Mes anterior" },
  { value: "year", label: "Último año" },
  { value: "all", label: "Máximo" },
];

/**
 * Filtro de rango como el del panel original: atajos rápidos arriba y un
 * desde/hasta manual detrás de un popover.
 */
export function PeriodFilter({
  current,
  from,
  to,
  compact = false,
}: {
  current: PeriodPreset;
  from?: string;
  to?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const push = (next: URLSearchParams) => {
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  const setPreset = (preset: PeriodPreset) => {
    const next = new URLSearchParams(params);
    next.set("periodo", preset);
    next.delete("desde");
    next.delete("hasta");
    push(next);
  };

  const setCustom = (formData: FormData) => {
    const next = new URLSearchParams(params);
    const desde = String(formData.get("desde") ?? "");
    const hasta = String(formData.get("hasta") ?? "");
    if (!desde || !hasta) return;
    next.set("periodo", "custom");
    next.set("desde", desde);
    next.set("hasta", hasta);
    push(next);
  };

  const visible = compact ? PRESETS.slice(0, 6) : PRESETS;
  const isCustom = Boolean(from && to);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="no-scrollbar -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 py-0.5">
        {visible.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => setPreset(preset.value)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
              !isCustom && current === preset.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={isCustom ? "default" : "outline"}
            size="sm"
            className="h-8 shrink-0 rounded-full"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarRange className="size-4" />
            )}
            {isCustom ? `${from} — ${to}` : "Personalizado"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <form action={setCustom} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="desde" className="text-xs">
                  Desde
                </Label>
                <Input id="desde" name="desde" type="date" defaultValue={from} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hasta" className="text-xs">
                  Hasta
                </Label>
                <Input id="hasta" name="hasta" type="date" defaultValue={to} required />
              </div>
            </div>
            <Button type="submit" size="sm" className="w-full">
              Aplicar
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}

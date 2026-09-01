"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "todas", label: "Todas" },
  { value: "activas", label: "Activas" },
  { value: "con-cita", label: "Con cita próxima" },
  { value: "con-saldo", label: "Con saldo" },
  { value: "con-bono", label: "Con bono" },
  { value: "nuevas", label: "Nuevas este mes" },
  { value: "inactivas", label: "Inactivas" },
];

const SORTS = [
  { value: "recientes", label: "Más recientes" },
  { value: "nombre", label: "Nombre A-Z" },
  { value: "gasto", label: "Mayor gasto" },
  { value: "ultima-visita", label: "Última visita" },
];

export function ClientFilters({
  query,
  filter,
  sort,
}: {
  query?: string;
  filter: string;
  sort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(query ?? "");

  const push = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Búsqueda con retardo para no navegar en cada tecla.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (text === current) return;
    const timer = setTimeout(() => push("q", text.trim() || undefined), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Buscar por nombre, teléfono o correo"
            className="pl-9"
          />
          {pending ? (
            <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
          ) : null}
        </div>

        <Select value={sort} onValueChange={(value) => push("orden", value)}>
          <SelectTrigger className="w-40 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => push("filtro", option.value === "todas" ? undefined : option.value)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
              filter === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

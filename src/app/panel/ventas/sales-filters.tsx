"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SALE_STATUS_LABELS } from "@/components/panel/status-badge";

export function SalesFilters({
  specialists,
  specialistId,
  status,
  query,
}: {
  specialists: { id: string; name: string; color: string }[];
  specialistId?: string;
  status?: string;
  query?: string;
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

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (text === current) return;
    const timer = setTimeout(() => push("q", text.trim() || undefined), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const pill = (active: boolean) =>
    cn(
      "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
      active
        ? "bg-primary text-primary-foreground"
        : "bg-secondary text-secondary-foreground hover:bg-accent",
    );

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Buscar por clienta"
          className="pl-9"
        />
        {pending ? (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
        ) : null}
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
        <button type="button" onClick={() => push("estado")} className={pill(!status)}>
          Todos los estados
        </button>
        {(["PAID", "PARTIAL", "PENDING", "CANCELLED"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => push("estado", value)}
            className={pill(status === value)}
          >
            {SALE_STATUS_LABELS[value]}
          </button>
        ))}
      </div>

      {specialists.length > 1 ? (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
          <button
            type="button"
            onClick={() => push("especialista")}
            className={pill(!specialistId)}
          >
            Todo el equipo
          </button>
          {specialists.map((specialist) => (
            <button
              key={specialist.id}
              type="button"
              onClick={() => push("especialista", specialist.id)}
              className={cn(pill(specialistId === specialist.id), "flex items-center gap-1.5")}
            >
              <span className="size-2 rounded-full" style={{ background: specialist.color }} />
              {specialist.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

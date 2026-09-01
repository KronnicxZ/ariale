import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/money";

type Props = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Variación contra el periodo anterior, en puntos porcentuales. */
  delta?: number | null;
  /** Cuando es true, un delta negativo es buena noticia (costos, gastos). */
  invertDelta?: boolean;
  featured?: boolean;
  icon?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function StatCard({
  label,
  value,
  hint,
  delta,
  invertDelta = false,
  featured = false,
  icon,
  footer,
  className,
}: Props) {
  const hasDelta = delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.05;
  const positive = hasDelta ? (invertDelta ? delta! < 0 : delta! > 0) : false;

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:p-5",
        featured
          ? "menu-gradient border-transparent text-white shadow-lg shadow-black/10"
          : "border-border bg-card text-card-foreground",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-xs font-medium tracking-wide uppercase",
            featured ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        {icon ? (
          <span className={cn("shrink-0", featured ? "text-white/60" : "text-muted-foreground")}>
            {icon}
          </span>
        ) : null}
      </div>

      <div className="space-y-1">
        <div
          className={cn(
            "font-numeric text-2xl leading-none font-semibold sm:text-3xl",
            featured && "text-white",
          )}
        >
          {value}
        </div>
        {hint ? (
          <p className={cn("text-xs", featured ? "text-white/60" : "text-muted-foreground")}>
            {hint}
          </p>
        ) : null}
      </div>

      {hasDelta ? (
        <div
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            featured
              ? "bg-white/15 text-white"
              : positive
                ? "bg-success/12 text-success"
                : "bg-destructive/10 text-destructive",
          )}
        >
          {delta! > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
          {formatPercent(Math.abs(delta!))} vs. periodo anterior
        </div>
      ) : null}

      {footer}
    </div>
  );
}

import { cn } from "@/lib/utils";
import { formatBs, formatUsd } from "@/lib/money";

/**
 * Importe en dólares con su equivalente en bolívares debajo, que es como lo
 * lee todo el mundo en Venezuela.
 */
export function Money({
  cents,
  rate,
  className,
  bsClassName,
  showBs = true,
  compact = false,
}: {
  cents: number;
  rate?: number;
  className?: string;
  bsClassName?: string;
  showBs?: boolean;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex flex-col leading-tight", className)}>
      <span className="tabular-nums">{formatUsd(cents, compact)}</span>
      {showBs && rate ? (
        <span className={cn("text-[0.72em] font-normal opacity-70 tabular-nums", bsClassName)}>
          {formatBs(cents, rate)}
        </span>
      ) : null}
    </span>
  );
}

/** Solo el número, en una línea. Para tablas densas. */
export function Amount({
  cents,
  className,
  compact,
}: {
  cents: number;
  className?: string;
  compact?: boolean;
}) {
  return <span className={cn("tabular-nums", className)}>{formatUsd(cents, compact)}</span>;
}

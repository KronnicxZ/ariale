/**
 * Todo el dinero vive en centavos de USD (enteros). Nunca en float.
 * Los bolívares se derivan al momento de mostrar, con la tasa del día.
 */

export function toCents(amount: number | string): number {
  const n = typeof amount === "string" ? parseFloat(amount.replace(",", ".")) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

// Formateamos el número y ponemos el símbolo aparte: es-VE con
// style:"currency" devuelve "USD 12,00", y en el salón se lee "$12,00".
const usd = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdCompact = new Intl.NumberFormat("es-VE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const bs = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1463000 -> "$14.630,00" · los negativos salen como "−$120,00" */
export function formatUsd(cents: number, compact = false): string {
  const value = fromCents(cents);
  const formatter = compact && Math.abs(value) >= 10_000 ? usdCompact : usd;
  const sign = value < 0 ? "−" : "";
  return sign + "$" + formatter.format(Math.abs(value));
}

/** 1500 centavos con tasa 791.67 -> "11.875,05 Bs." */
export function formatBs(cents: number, rate: number): string {
  if (!rate || rate <= 0) return "—";
  return `${bs.format(fromCents(cents) * rate)} Bs.`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-VE").format(value);
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

/** Porcentaje seguro: devuelve 0 cuando el divisor es 0. */
export function ratio(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_USD: "Efectivo $",
  CASH_VES: "Efectivo Bs.",
  PAGO_MOVIL: "Pago móvil",
  TRANSFER: "Transferencia",
  ZELLE: "Zelle",
  BINANCE: "Binance",
  CARD: "Tarjeta",
  OTHER: "Otro",
};

/** Métodos que se liquidan en bolívares y por tanto usan la tasa del día. */
export const VES_METHODS = new Set(["CASH_VES", "PAGO_MOVIL", "TRANSFER"]);

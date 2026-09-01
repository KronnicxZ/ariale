import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-success/12 text-success ring-success/20",
  warning: "bg-warning/15 text-warning-foreground ring-warning/25",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  neutral: "bg-muted text-muted-foreground ring-border",
  brand: "bg-primary/10 text-primary ring-primary/20",
} as const;

type Tone = keyof typeof TONES;

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const SALE_STATUS: Record<string, { label: string; tone: Tone }> = {
  PAID: { label: "Pagado", tone: "success" },
  PARTIAL: { label: "Parcial", tone: "warning" },
  PENDING: { label: "Pendiente", tone: "danger" },
  CANCELLED: { label: "Anulada", tone: "neutral" },
};

export function SaleStatusBadge({ status }: { status: string }) {
  const config = SALE_STATUS[status] ?? SALE_STATUS.PENDING;
  return <StatusBadge tone={config.tone}>{config.label}</StatusBadge>;
}

const APPOINTMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Por confirmar", tone: "warning" },
  CONFIRMED: { label: "Confirmada", tone: "success" },
  ATTENDED: { label: "Atendida", tone: "brand" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
  NO_SHOW: { label: "No asistió", tone: "danger" },
};

export function AppointmentStatusBadge({ status }: { status: string }) {
  const config = APPOINTMENT_STATUS[status] ?? APPOINTMENT_STATUS.PENDING;
  return <StatusBadge tone={config.tone}>{config.label}</StatusBadge>;
}

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(APPOINTMENT_STATUS).map(([k, v]) => [k, v.label]),
);

export const SALE_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SALE_STATUS).map(([k, v]) => [k, v.label]),
);

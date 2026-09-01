import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgePercent,
  CalendarClock,
  CircleSlash,
  MessageCircle,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { SaleStatusBadge, StatusBadge } from "@/components/panel/status-badge";
import { getSale } from "@/data/sales";
import { fmtDate, fmtDayLong, fmtTime } from "@/lib/date";
import { PAYMENT_METHOD_LABELS, formatUsd } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { formatPhone } from "@/lib/utils";
import { debtMessage, waLink } from "@/lib/whatsapp";
import { cancelSaleAction, deleteSaleAction } from "@/actions/sales";
import { PaymentForm } from "./payment-form";

export async function generateMetadata(props: PageProps<"/panel/ventas/[id]">) {
  const { id } = await props.params;
  const sale = await getSale(id);
  return { title: sale ? `Venta #${sale.number}` : "Venta" };
}

export default async function SalePage(props: PageProps<"/panel/ventas/[id]">) {
  const { id } = await props.params;
  const [sale, settings, rateInfo] = await Promise.all([getSale(id), getSettings(), getRate()]);
  if (!sale) notFound();

  const balanceCents = sale.totalCents - sale.paidCents;
  const overdue = Boolean(sale.dueDate && sale.dueDate < new Date() && balanceCents > 0);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/panel/ventas"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition"
      >
        <ArrowLeft className="size-4" />
        Volver a ventas
      </Link>

      <div className="bg-card rounded-2xl border p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-sm">
              {fmtDate(sale.date, settings.timezone)}
            </p>
            <h1 className="font-heading text-2xl font-semibold">Venta #{sale.number}</h1>
            <Link
              href={`/panel/clientes/${sale.client.id}`}
              className="hover:text-primary mt-0.5 inline-flex items-center gap-1.5 text-sm transition"
            >
              <UserRound className="size-3.5" />
              {sale.client.name}
            </Link>
            {sale.specialist ? (
              <p className="text-muted-foreground text-xs">
                Atendida por {sale.specialist.name}
              </p>
            ) : null}
          </div>
          <SaleStatusBadge status={sale.status} />
        </div>

        {sale.appointment ? (
          <Link
            href={`/panel/agenda/${sale.appointment.id}`}
            className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1.5 text-sm transition"
          >
            <CalendarClock className="size-3.5" />
            Cita del {fmtDayLong(sale.appointment.startAt, settings.timezone)} a las{" "}
            {fmtTime(sale.appointment.startAt, settings.timezone)}
          </Link>
        ) : null}

        <ul className="mt-4 space-y-2 border-t pt-4">
          {sale.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block font-medium">{item.description}</span>
                <span className="text-muted-foreground text-xs">
                  {item.quantity} × {formatUsd(item.unitPriceCents)}
                  {item.clientPackage ? ` · descontado de ${item.clientPackage.package.name}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {item.clientPackage ? (
                  <StatusBadge tone="brand">Bono</StatusBadge>
                ) : (
                  formatUsd(item.totalCents)
                )}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1.5 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatUsd(sale.subtotalCents)}</dd>
          </div>
          {sale.discountCents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Descuento</dt>
              <dd className="text-destructive tabular-nums">−{formatUsd(sale.discountCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
            <dt>Total</dt>
            <dd>
              <Money cents={sale.totalCents} rate={rateInfo.rate} className="items-end" />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Cobrado</dt>
            <dd className="text-success font-medium tabular-nums">
              {formatUsd(sale.paidCents)}
            </dd>
          </div>
          {balanceCents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Saldo</dt>
              <dd className="text-destructive font-semibold tabular-nums">
                {formatUsd(balanceCents)}
              </dd>
            </div>
          ) : null}
        </dl>

        {sale.dueDate ? (
          <p
            className={
              overdue
                ? "bg-destructive/10 text-destructive mt-3 rounded-lg px-3 py-2 text-sm"
                : "text-muted-foreground mt-3 text-sm"
            }
          >
            Vence el {fmtDate(sale.dueDate, settings.timezone)}
            {overdue ? " · vencida" : ""}
          </p>
        ) : null}

        {sale.notes ? (
          <p className="bg-muted/60 mt-3 rounded-xl px-3 py-2.5 text-sm">{sale.notes}</p>
        ) : null}
      </div>

      {sale.packagesSold.length > 0 ? (
        <div className="bg-card rounded-2xl border p-5">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <BadgePercent className="text-muted-foreground size-4" />
            Bono vendido
          </h2>
          {sale.packagesSold.map((entry) => (
            <p key={entry.id} className="text-sm">
              <strong>{entry.package.name}</strong> · {entry.sessionsTotal} sesiones · vence el{" "}
              {fmtDate(entry.expiresAt, settings.timezone)}
            </p>
          ))}
        </div>
      ) : null}

      {balanceCents > 0 && sale.status !== "CANCELLED" ? (
        <div className="bg-card rounded-2xl border p-5">
          <h2 className="mb-1 font-semibold">Registrar abono</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Faltan {formatUsd(balanceCents)} por cobrar.
          </p>
          <PaymentForm saleId={sale.id} balanceCents={balanceCents} rate={rateInfo.rate} />

          <a
            href={waLink(
              sale.client.phone,
              debtMessage(sale.client.name, balanceCents, settings.businessName, rateInfo.rate),
              settings.countryCode,
            )}
            target="_blank"
            rel="noreferrer"
            className="text-success mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            <MessageCircle className="size-4" />
            Recordarle por WhatsApp
          </a>
        </div>
      ) : null}

      <div className="bg-card rounded-2xl border p-5">
        <h2 className="mb-3 font-semibold">Pagos recibidos</h2>
        {sale.payments.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavía no hay pagos.</p>
        ) : (
          <ul className="divide-y">
            {sale.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {fmtDate(payment.date, settings.timezone)}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-medium tabular-nums">
                    {formatUsd(payment.amountCents)}
                  </span>
                  {payment.rateUsed ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      a {payment.rateUsed.toFixed(2)} Bs.
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/panel/clientes/${sale.client.id}`}>
            <UserRound className="size-4" />
            {formatPhone(sale.client.phone, settings.countryCode)}
          </Link>
        </Button>
        {sale.status !== "CANCELLED" ? (
          <form action={cancelSaleAction}>
            <input type="hidden" name="id" value={sale.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              <CircleSlash className="size-4" />
              Anular
            </Button>
          </form>
        ) : null}
        <form action={deleteSaleAction} className="ml-auto">
          <input type="hidden" name="id" value={sale.id} />
          <Button type="submit" variant="ghost" size="sm" className="text-destructive">
            <Trash2 className="size-4" />
            Eliminar
          </Button>
        </form>
      </div>
    </div>
  );
}

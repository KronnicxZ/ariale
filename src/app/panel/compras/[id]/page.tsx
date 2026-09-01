import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/panel/page-header";
import { SaleStatusBadge } from "@/components/panel/status-badge";
import { prisma } from "@/lib/db";
import { dayKey, fmtDate } from "@/lib/date";
import { PAYMENT_METHOD_LABELS, formatUsd } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { deletePurchaseAction } from "@/actions/finance";
import { PurchaseForm } from "../purchase-form";
import { PurchasePaymentForm } from "./purchase-payment-form";

export const metadata = { title: "Compra" };

export default async function PurchasePage(props: PageProps<"/panel/compras/[id]">) {
  const { id } = await props.params;
  const [purchase, suppliers, settings] = await Promise.all([
    prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: { select: { name: true } },
        payments: { orderBy: { date: "desc" } },
      },
    }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  if (!purchase) notFound();

  const balanceCents = purchase.totalCents - purchase.paidCents;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/panel/compras"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition"
      >
        <ArrowLeft className="size-4" />
        Volver a compras
      </Link>

      <PageHeader
        title={`Compra #${purchase.number}`}
        description={`${purchase.supplier?.name ?? "Sin proveedor"} · ${fmtDate(purchase.date, settings.timezone)}`}
        actions={<SaleStatusBadge status={purchase.status} />}
      />

      {balanceCents > 0 ? (
        <div className="surface p-5">
          <h2 className="mb-1 font-semibold">Registrar pago</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Faltan {formatUsd(balanceCents)} por pagar.
          </p>
          <PurchasePaymentForm purchaseId={purchase.id} balanceCents={balanceCents} />
        </div>
      ) : null}

      <div className="surface p-5">
        <h2 className="mb-3 font-semibold">Pagos realizados</h2>
        {purchase.payments.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavía no hay pagos.</p>
        ) : (
          <ul className="divide-y">
            {purchase.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5">
                <span>
                  <span className="block text-sm font-medium">
                    {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {fmtDate(payment.date, settings.timezone)}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </span>
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {formatUsd(payment.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PurchaseForm
        purchase={purchase}
        suppliers={suppliers}
        today={dayKey(new Date(), settings.timezone)}
      />

      <form action={deletePurchaseAction} className="border-destructive/25 rounded-2xl border p-5">
        <input type="hidden" name="id" value={purchase.id} />
        <h2 className="font-semibold">Eliminar compra</h2>
        <p className="text-muted-foreground mt-1 mb-3 text-sm">
          Se borra junto con sus pagos. No se puede deshacer.
        </p>
        <Button type="submit" variant="outline" className="text-destructive">
          <Trash2 className="size-4" />
          Eliminar
        </Button>
      </form>
    </div>
  );
}

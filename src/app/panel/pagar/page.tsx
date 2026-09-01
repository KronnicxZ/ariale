import Link from "next/link";
import { AlertTriangle, CheckCheck, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { StatCard } from "@/components/panel/stat-card";
import { SaleStatusBadge } from "@/components/panel/status-badge";
import { getPayables } from "@/data/sales";
import { fmtDate } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { stringParam } from "@/lib/period";
import { quickPayPurchaseAction } from "@/actions/finance";
import { cn } from "@/lib/utils";

export const metadata = { title: "Cuentas por pagar" };

export default async function PayablesPage(props: PageProps<"/panel/pagar">) {
  const params = await props.searchParams;
  const onlyOverdue = stringParam(params, "estado") === "vencidas";

  const [{ rows, totals }, settings, rateInfo] = await Promise.all([
    getPayables({ overdue: onlyOverdue }),
    getSettings(),
    getRate(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cuentas por pagar"
        description="Lo que el estudio debe a proveedores"
        actions={
          <Button asChild size="sm" variant={onlyOverdue ? "default" : "outline"}>
            <Link href={onlyOverdue ? "/panel/pagar" : "/panel/pagar?estado=vencidas"}>
              <AlertTriangle className="size-4" />
              {onlyOverdue ? "Ver todas" : "Solo vencidas"}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Por pagar"
          value={<Money cents={totals.totalCents} rate={rateInfo.rate} />}
          hint={`${totals.count} ${totals.count === 1 ? "cuenta" : "cuentas"}`}
        />
        <StatCard label="Ya pagado" value={<Money cents={totals.paidCents} rate={rateInfo.rate} />} />
        <StatCard
          featured
          label="Saldo"
          value={<Money cents={totals.balanceCents} rate={rateInfo.rate} bsClassName="text-white/60" />}
          hint={totals.overdueCount > 0 ? `${totals.overdueCount} vencidas` : "Nada vencido"}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<PartyPopper className="size-8" />}
          title="No debes nada"
          description="No hay cuentas por pagar en este momento."
        />
      ) : (
        <>
          <div className="bg-card hidden overflow-hidden rounded-2xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium">Proveedor</th>
                  <th className="px-4 py-2.5 font-medium">Descripción</th>
                  <th className="px-4 py-2.5 font-medium">Vence</th>
                  <th className="px-4 py-2.5 text-right font-medium">Importe</th>
                  <th className="px-4 py-2.5 text-right font-medium">Pagado</th>
                  <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                  <th className="px-4 py-2.5 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn("hover:bg-accent/40 transition", row.overdue && "bg-destructive/[0.03]")}
                  >
                    <td className="px-4 py-2.5 font-medium">{row.supplier?.name ?? "Sin proveedor"}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/panel/compras/${row.id}`} className="block max-w-[16rem] truncate">
                        {row.description}
                        <span className="text-muted-foreground block text-xs">
                          Compra #{row.number}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {row.dueDate ? (
                        <span className={row.overdue ? "text-destructive font-medium" : ""}>
                          {fmtDate(row.dueDate, settings.timezone)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sin fecha</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatUsd(row.totalCents)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatUsd(row.paidCents)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {formatUsd(row.balanceCents)}
                    </td>
                    <td className="px-4 py-2.5">
                      <form action={quickPayPurchaseAction}>
                        <input type="hidden" name="purchaseId" value={row.id} />
                        <Button type="submit" size="xs">
                          <CheckCheck className="size-3.5" />
                          Pagar
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-medium">
                <tr>
                  <td className="px-4 py-2.5" colSpan={3}>
                    Totales
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatUsd(totals.totalCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatUsd(totals.paidCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatUsd(totals.balanceCents)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "bg-card rounded-2xl border p-3.5",
                  row.overdue && "border-destructive/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{row.supplier?.name ?? "Sin proveedor"}</p>
                    <Link
                      href={`/panel/compras/${row.id}`}
                      className="text-muted-foreground block truncate text-xs"
                    >
                      {row.description}
                    </Link>
                    {row.dueDate ? (
                      <p
                        className={cn(
                          "mt-0.5 text-xs",
                          row.overdue ? "text-destructive font-medium" : "text-muted-foreground",
                        )}
                      >
                        {row.overdue ? "Vencida" : "Vence"} el{" "}
                        {fmtDate(row.dueDate, settings.timezone)}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">{formatUsd(row.balanceCents)}</p>
                    <SaleStatusBadge status={row.status} />
                  </div>
                </div>
                <form action={quickPayPurchaseAction} className="mt-3 border-t pt-3">
                  <input type="hidden" name="purchaseId" value={row.id} />
                  <button
                    type="submit"
                    className="bg-primary text-primary-foreground flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium"
                  >
                    <CheckCheck className="size-4" />
                    Marcar como pagada
                  </button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

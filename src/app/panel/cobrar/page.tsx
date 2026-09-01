import Link from "next/link";
import { AlertTriangle, HandCoins, MessageCircle, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { StatCard } from "@/components/panel/stat-card";
import { SaleStatusBadge } from "@/components/panel/status-badge";
import { getReceivables } from "@/data/sales";
import { fmtDate } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { stringParam } from "@/lib/period";
import { debtMessage, waLink } from "@/lib/whatsapp";
import { quickCollectAction } from "@/actions/sales";
import { cn } from "@/lib/utils";

export const metadata = { title: "Cuentas por cobrar" };

export default async function ReceivablesPage(props: PageProps<"/panel/cobrar">) {
  const params = await props.searchParams;
  const onlyOverdue = stringParam(params, "estado") === "vencidas";

  const [{ rows, totals }, settings, rateInfo] = await Promise.all([
    getReceivables({ overdue: onlyOverdue }),
    getSettings(),
    getRate(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cuentas por cobrar"
        description="Saldos pendientes de las clientas"
        actions={
          <Button asChild size="sm" variant={onlyOverdue ? "default" : "outline"}>
            <Link href={onlyOverdue ? "/panel/cobrar" : "/panel/cobrar?estado=vencidas"}>
              <AlertTriangle className="size-4" />
              {onlyOverdue ? "Ver todas" : "Solo vencidas"}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Por cobrar"
          value={<Money cents={totals.totalCents} rate={rateInfo.rate} />}
          hint={`${totals.count} ${totals.count === 1 ? "cuenta" : "cuentas"}`}
        />
        <StatCard label="Ya cobrado" value={<Money cents={totals.paidCents} rate={rateInfo.rate} />} />
        <StatCard
          featured
          label="Saldo"
          value={<Money cents={totals.balanceCents} rate={rateInfo.rate} bsClassName="text-white/60" />}
          hint={
            totals.overdueCount > 0
              ? `${totals.overdueCount} vencidas · ${formatUsd(totals.overdueCents)}`
              : "Nada vencido"
          }
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<PartyPopper className="size-8" />}
          title={onlyOverdue ? "No hay cuentas vencidas" : "No hay nada por cobrar"}
          description="Todas las clientas están al día. Bien hecho."
        />
      ) : (
        <>
          {/* Escritorio */}
          <div className="bg-card hidden overflow-hidden rounded-2xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium">Clienta</th>
                  <th className="px-4 py-2.5 font-medium">Concepto</th>
                  <th className="px-4 py-2.5 font-medium">Vence</th>
                  <th className="px-4 py-2.5 text-right font-medium">Importe</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cobrado</th>
                  <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                  <th className="px-4 py-2.5 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className={cn("hover:bg-accent/40 transition", row.overdue && "bg-destructive/[0.03]")}>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/panel/clientes/${row.client.id}`}
                        className="hover:text-primary font-medium transition"
                      >
                        {row.client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/panel/ventas/${row.id}`} className="block max-w-[16rem] truncate">
                        {row.description}
                        <span className="text-muted-foreground block text-xs">
                          Venta #{row.number}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {row.dueDate ? (
                        <span className={row.overdue ? "text-destructive font-medium" : ""}>
                          {fmtDate(row.dueDate, settings.timezone)}
                          {row.overdue ? (
                            <span className="block text-xs">
                              Vencida hace {row.daysOverdue} d
                            </span>
                          ) : null}
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
                      <div className="flex items-center gap-1.5">
                        <form action={quickCollectAction}>
                          <input type="hidden" name="saleId" value={row.id} />
                          <input type="hidden" name="percent" value="100" />
                          <Button type="submit" size="xs">
                            Cobrar
                          </Button>
                        </form>
                        <a
                          href={waLink(
                            row.client.phone,
                            debtMessage(
                              row.client.name,
                              row.balanceCents,
                              settings.businessName,
                              rateInfo.rate,
                            ),
                            settings.countryCode,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-success/12 text-success hover:bg-success/20 grid size-7 place-items-center rounded-md transition"
                          aria-label="Recordar por WhatsApp"
                        >
                          <MessageCircle className="size-3.5" />
                        </a>
                      </div>
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

          {/* Móvil */}
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
                    <Link
                      href={`/panel/clientes/${row.client.id}`}
                      className="block font-medium"
                    >
                      {row.client.name}
                    </Link>
                    <Link
                      href={`/panel/ventas/${row.id}`}
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
                    <p className="text-muted-foreground text-xs tabular-nums">
                      de {formatUsd(row.totalCents)}
                    </p>
                    <SaleStatusBadge status={row.status} />
                  </div>
                </div>

                <div className="mt-3 flex gap-2 border-t pt-3">
                  <form action={quickCollectAction} className="flex-1">
                    <input type="hidden" name="saleId" value={row.id} />
                    <input type="hidden" name="percent" value="100" />
                    <button
                      type="submit"
                      className="bg-primary text-primary-foreground flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium"
                    >
                      <HandCoins className="size-4" />
                      Cobrar todo
                    </button>
                  </form>
                  <a
                    href={waLink(
                      row.client.phone,
                      debtMessage(
                        row.client.name,
                        row.balanceCents,
                        settings.businessName,
                        rateInfo.rate,
                      ),
                      settings.countryCode,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-success/12 text-success flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium"
                  >
                    <MessageCircle className="size-4" />
                    Recordar
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

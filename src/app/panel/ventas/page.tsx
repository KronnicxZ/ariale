import Link from "next/link";
import { Receipt, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { PeriodFilter } from "@/components/panel/period-filter";
import { SaleStatusBadge } from "@/components/panel/status-badge";
import { StatCard } from "@/components/panel/stat-card";
import { Money } from "@/components/ui/money";
import { SalesFilters } from "./sales-filters";
import { getSales } from "@/data/sales";
import { fmtDate } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { periodFromParams, stringParam } from "@/lib/period";
import type { SaleStatus } from "@/generated/prisma/client";

export const metadata = { title: "Ventas" };

const STATUSES = new Set(["PENDING", "PARTIAL", "PAID", "CANCELLED"]);

export default async function SalesPage(props: PageProps<"/panel/ventas">) {
  const params = await props.searchParams;
  const settings = await getSettings();
  const { period, preset, from, to } = periodFromParams(params, "last30", settings.timezone);

  const statusParam = stringParam(params, "estado");
  const status = statusParam && STATUSES.has(statusParam) ? (statusParam as SaleStatus) : undefined;
  const clientQuery = stringParam(params, "q");
  const specialistId = stringParam(params, "especialista");

  const [{ sales, specialists, totals }, rateInfo] = await Promise.all([
    getSales({ period, status, clientQuery, specialistId }),
    getRate(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ventas"
        description="Citas cobradas y pendientes"
        actions={
          <Button asChild size="sm">
            <Link href="/panel/ventas/nueva">
              <Receipt className="size-4" />
              Nueva venta
            </Link>
          </Button>
        }
      />

      <PeriodFilter current={preset} from={from} to={to} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Ventas"
          value={<Money cents={totals.totalCents} rate={rateInfo.rate} />}
          hint={`${totals.count} ${totals.count === 1 ? "venta" : "ventas"}`}
        />
        <StatCard
          label="Cobrado"
          value={<Money cents={totals.paidCents} rate={rateInfo.rate} />}
        />
        <StatCard
          featured
          label="Pendiente"
          value={
            <Money cents={totals.pendingCents} rate={rateInfo.rate} bsClassName="text-white/60" />
          }
        />
      </div>

      <SalesFilters
        specialists={specialists}
        specialistId={specialistId}
        status={statusParam}
        query={clientQuery}
      />

      {sales.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="size-8" />}
          title="No hay ventas en este periodo"
          description="Cambia el rango de fechas o registra la primera venta."
          action={
            <Button asChild size="sm">
              <Link href="/panel/ventas/nueva">
                <Receipt className="size-4" />
                Nueva venta
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="bg-card hidden overflow-hidden rounded-2xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Clienta</th>
                  <th className="px-4 py-2.5 font-medium">Especialista</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cobrado</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-accent/40 transition">
                    <td className="px-4 py-2.5">
                      <Link href={`/panel/ventas/${sale.id}`} className="block">
                        {fmtDate(sale.date, settings.timezone)}
                        <span className="text-muted-foreground block text-xs">
                          #{sale.number}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/panel/ventas/${sale.id}`} className="block">
                        {sale.client.name}
                        <span className="text-muted-foreground block max-w-[18rem] truncate text-xs">
                          {sale.items.map((i) => i.description).join(", ")}
                        </span>
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5">
                      {sale.specialist?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatUsd(sale.totalCents)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatUsd(sale.paidCents)}
                    </td>
                    <td className="px-4 py-2.5">
                      <SaleStatusBadge status={sale.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-medium">
                <tr>
                  <td className="px-4 py-2.5" colSpan={3}>
                    Totales del periodo
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatUsd(totals.totalCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatUsd(totals.paidCents)}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 text-xs">
                    Pendiente {formatUsd(totals.pendingCents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Móvil: tarjetas */}
          <div className="space-y-2 md:hidden">
            {sales.map((sale) => (
              <Link
                key={sale.id}
                href={`/panel/ventas/${sale.id}`}
                className="bg-card block rounded-2xl border p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{sale.client.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {sale.items.map((i) => i.description).join(", ")}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {fmtDate(sale.date, settings.timezone)} · #{sale.number}
                      {sale.specialist ? ` · ${sale.specialist.name}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">{formatUsd(sale.totalCents)}</p>
                    {sale.paidCents < sale.totalCents ? (
                      <p className="text-destructive text-xs tabular-nums">
                        Debe {formatUsd(sale.totalCents - sale.paidCents)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2">
                  <SaleStatusBadge status={sale.status} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

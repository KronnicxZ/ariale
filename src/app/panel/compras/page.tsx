import Link from "next/link";
import { PackageOpen, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { PeriodFilter } from "@/components/panel/period-filter";
import { StatCard } from "@/components/panel/stat-card";
import { SaleStatusBadge } from "@/components/panel/status-badge";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { periodFromParams } from "@/lib/period";

export const metadata = { title: "Compras" };

export default async function PurchasesPage(props: PageProps<"/panel/compras">) {
  const params = await props.searchParams;
  const settings = await getSettings();
  const { period, preset, from, to } = periodFromParams(params, "last30", settings.timezone);

  const [purchases, rateInfo] = await Promise.all([
    prisma.purchase.findMany({
      where: { date: { gte: period.from, lte: period.to } },
      orderBy: { date: "desc" },
      include: { supplier: { select: { name: true } } },
    }),
    getRate(),
  ]);

  const active = purchases.filter((p) => p.status !== "CANCELLED");
  const totalCents = active.reduce((sum, p) => sum + p.totalCents, 0);
  const paidCents = active.reduce((sum, p) => sum + p.paidCents, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Compras"
        description="Insumos y mercancía del estudio"
        actions={
          <Button asChild size="sm">
            <Link href="/panel/compras/nueva">
              <ShoppingBag className="size-4" />
              Nueva compra
            </Link>
          </Button>
        }
      />

      <PeriodFilter current={preset} from={from} to={to} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Compras"
          value={<Money cents={totalCents} rate={rateInfo.rate} />}
          hint={`${active.length} ${active.length === 1 ? "compra" : "compras"}`}
        />
        <StatCard label="Pagado" value={<Money cents={paidCents} rate={rateInfo.rate} />} />
        <StatCard
          featured
          label="Pendiente"
          value={
            <Money
              cents={totalCents - paidCents}
              rate={rateInfo.rate}
              bsClassName="text-white/60"
            />
          }
        />
      </div>

      {purchases.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="size-8" />}
          title="No hay compras en este periodo"
          description="Registra lo que compras a proveedores para llevar el costo real."
          action={
            <Button asChild size="sm">
              <Link href="/panel/compras/nueva">
                <ShoppingBag className="size-4" />
                Nueva compra
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="surface hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Proveedor</th>
                  <th className="px-4 py-2.5 font-medium">Descripción</th>
                  <th className="px-4 py-2.5 text-right font-medium">Monto</th>
                  <th className="px-4 py-2.5 text-right font-medium">Pagado</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-accent/40 transition">
                    <td className="px-4 py-2.5">
                      <Link href={`/panel/compras/${purchase.id}`} className="block">
                        {fmtDate(purchase.date, settings.timezone)}
                        <span className="text-muted-foreground block text-xs">
                          #{purchase.number}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{purchase.supplier?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/panel/compras/${purchase.id}`}
                        className="block max-w-[20rem] truncate"
                      >
                        {purchase.description}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatUsd(purchase.totalCents)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatUsd(purchase.paidCents)}
                    </td>
                    <td className="px-4 py-2.5">
                      <SaleStatusBadge status={purchase.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-medium">
                <tr>
                  <td className="px-4 py-2.5" colSpan={3}>
                    Totales del periodo
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatUsd(totalCents)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatUsd(paidCents)}</td>
                  <td className="text-muted-foreground px-4 py-2.5 text-xs">
                    Pendiente {formatUsd(totalCents - paidCents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {purchases.map((purchase) => (
              <Link
                key={purchase.id}
                href={`/panel/compras/${purchase.id}`}
                className="surface block p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{purchase.supplier?.name ?? "Sin proveedor"}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {purchase.description}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {fmtDate(purchase.date, settings.timezone)} · #{purchase.number}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">
                      {formatUsd(purchase.totalCents)}
                    </p>
                    {purchase.paidCents < purchase.totalCents ? (
                      <p className="text-destructive text-xs tabular-nums">
                        Debe {formatUsd(purchase.totalCents - purchase.paidCents)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2">
                  <SaleStatusBadge status={purchase.status} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

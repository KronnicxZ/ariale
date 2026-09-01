import Link from "next/link";
import { MessageCircle, Truck, TruckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { StatusBadge } from "@/components/panel/status-badge";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { formatPhone, initials } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { SupplierDialog } from "./supplier-dialog";

export const metadata = { title: "Proveedores" };

export default async function SuppliersPage() {
  const [suppliers, settings, rateInfo] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        purchases: {
          where: { status: { not: "CANCELLED" } },
          select: { totalCents: true, paidCents: true, date: true },
        },
      },
    }),
    getSettings(),
    getRate(),
  ]);

  const rows = suppliers.map((supplier) => {
    const totalCents = supplier.purchases.reduce((sum, p) => sum + p.totalCents, 0);
    const balanceCents = supplier.purchases.reduce(
      (sum, p) => sum + p.totalCents - p.paidCents,
      0,
    );
    const lastPurchase = supplier.purchases.sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    )[0];
    return { supplier, totalCents, balanceCents, lastPurchase };
  });

  const stats = {
    total: suppliers.length,
    withPurchases: rows.filter((r) => r.supplier.purchases.length > 0).length,
    balanceCents: rows.reduce((sum, r) => sum + r.balanceCents, 0),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Proveedores"
        description="A quién le compras los insumos"
        actions={<SupplierDialog />}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="surface-sm px-3 py-2.5">
          <p className="text-muted-foreground text-[0.7rem] uppercase">Proveedores</p>
          <p className="font-numeric text-xl font-semibold">{stats.total}</p>
        </div>
        <div className="surface-sm px-3 py-2.5">
          <p className="text-muted-foreground text-[0.7rem] uppercase">Con compras</p>
          <p className="font-numeric text-xl font-semibold">{stats.withPurchases}</p>
        </div>
        <div className="menu-gradient col-span-2 rounded-xl px-3 py-2.5 text-white sm:col-span-1">
          <p className="text-[0.7rem] text-white/60 uppercase">Saldo por pagar</p>
          <Money
            cents={stats.balanceCents}
            rate={rateInfo.rate}
            className="font-numeric text-xl font-semibold"
            bsClassName="text-white/50"
          />
        </div>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={<TruckIcon className="size-8" />}
          title="No hay proveedores registrados"
          description="Agrega el primero para registrar compras y cuentas por pagar."
          action={<SupplierDialog />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ supplier, totalCents, balanceCents, lastPurchase }) => (
            <article key={supplier.id} className="surface flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <span className="bg-secondary text-secondary-foreground grid size-11 shrink-0 place-items-center rounded-xl text-sm font-semibold">
                  {initials(supplier.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{supplier.name}</p>
                  {supplier.phone ? (
                    <p className="text-muted-foreground truncate text-xs">
                      {formatPhone(supplier.phone, settings.countryCode)}
                    </p>
                  ) : null}
                  {supplier.email ? (
                    <p className="text-muted-foreground truncate text-xs">{supplier.email}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-y py-2.5 text-center">
                <div>
                  <p className="text-muted-foreground text-[0.65rem] uppercase">Compras</p>
                  <p className="text-sm font-semibold">{supplier.purchases.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[0.65rem] uppercase">Total</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatUsd(totalCents, true)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[0.65rem] uppercase">Última</p>
                  <p className="text-sm font-semibold">
                    {lastPurchase ? fmtDate(lastPurchase.date, settings.timezone).slice(0, 5) : "—"}
                  </p>
                </div>
              </div>

              {balanceCents > 0 ? (
                <StatusBadge tone="danger">Le debes {formatUsd(balanceCents)}</StatusBadge>
              ) : null}
              {!supplier.active ? <StatusBadge>Inactivo</StatusBadge> : null}

              <div className="mt-auto flex gap-1.5">
                <SupplierDialog supplier={supplier} />
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <Link href={`/panel/compras/nueva?proveedor=${supplier.id}`}>
                    <Truck className="size-3.5" />
                    Nueva compra
                  </Link>
                </Button>
                {supplier.phone ? (
                  <a
                    href={waLink(supplier.phone, "Hola, buenas. ", settings.countryCode)}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-success/12 text-success hover:bg-success/20 grid size-8 shrink-0 place-items-center rounded-lg transition"
                    aria-label={`Escribir a ${supplier.name}`}
                  >
                    <MessageCircle className="size-4" />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

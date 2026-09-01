import Link from "next/link";
import { BadgePercent, TicketPercent } from "lucide-react";
import { Money } from "@/components/ui/money";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { StatusBadge } from "@/components/panel/status-badge";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/date";
import { formatUsd, ratio } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { PackageDialog } from "./package-dialog";
import { cn } from "@/lib/utils";

export const metadata = { title: "Bonos" };

/** Un bono que caduca en menos de un mes conviene recordarlo. */
function expiresSoon(expiresAt: Date) {
  return expiresAt.getTime() - Date.now() < 30 * 86_400_000;
}

export default async function PackagesPage() {
  const [packages, services, sold, settings, rateInfo] = await Promise.all([
    prisma.package.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        services: { include: { service: { select: { id: true, name: true, priceCents: true } } } },
        sold: { select: { sessionsTotal: true, sessionsUsed: true, pricePaidCents: true, status: true } },
      },
    }),
    prisma.service.findMany({
      where: { active: true },
      orderBy: [{ category: { order: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, priceCents: true, category: { select: { name: true } } },
    }),
    prisma.clientPackage.findMany({
      where: { status: "ACTIVE", expiresAt: { gte: new Date() } },
      orderBy: { expiresAt: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        package: { select: { name: true } },
      },
    }),
    getSettings(),
    getRate(),
  ]);

  const activeSold = sold.filter((s) => s.sessionsTotal - s.sessionsUsed > 0);
  const revenueCents = packages.reduce(
    (sum, pkg) => sum + pkg.sold.reduce((s, entry) => s + entry.pricePaidCents, 0),
    0,
  );
  const pendingSessions = activeSold.reduce(
    (sum, entry) => sum + (entry.sessionsTotal - entry.sessionsUsed),
    0,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bonos"
        description="Paquetes de sesiones prepagadas de depilación"
        actions={<PackageDialog services={services} />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="surface p-4">
          <p className="text-muted-foreground text-xs uppercase">Bonos en catálogo</p>
          <p className="font-numeric text-2xl font-semibold">{packages.length}</p>
        </div>
        <div className="surface p-4">
          <p className="text-muted-foreground text-xs uppercase">Sesiones por consumir</p>
          <p className="font-numeric text-2xl font-semibold">{pendingSessions}</p>
          <p className="text-muted-foreground text-xs">
            {activeSold.length} bonos activos de clientas
          </p>
        </div>
        <div className="menu-gradient rounded-2xl p-4 text-white">
          <p className="text-xs text-white/60 uppercase">Facturado en bonos</p>
          <Money
            cents={revenueCents}
            rate={rateInfo.rate}
            className="font-numeric text-2xl font-semibold"
            bsClassName="text-white/50"
          />
        </div>
      </div>

      {packages.length === 0 ? (
        <EmptyState
          icon={<TicketPercent className="size-8" />}
          title="Todavía no hay bonos"
          description="Un bono de 6 sesiones fideliza a la clienta y cobra por adelantado."
          action={<PackageDialog services={services} />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {packages.map((pkg) => {
            const fullPriceCents = pkg.services.reduce(
              (sum, entry) => sum + entry.service.priceCents,
              0,
            );
            const regularCents = fullPriceCents * pkg.sessions;
            const savingPct = regularCents > 0 ? 100 - ratio(pkg.priceCents, regularCents) : 0;
            const soldCount = pkg.sold.length;

            return (
              <article
                key={pkg.id}
                className={cn(
                  "surface flex flex-col gap-3 p-4",
                  !pkg.active && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{pkg.name}</p>
                    {pkg.description ? (
                      <p className="text-muted-foreground text-xs">{pkg.description}</p>
                    ) : null}
                  </div>
                  <span className="bg-primary/12 text-primary shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold">
                    {pkg.sessions}×
                  </span>
                </div>

                <div>
                  <Money
                    cents={pkg.priceCents}
                    rate={rateInfo.rate}
                    className="font-numeric text-2xl font-semibold"
                  />
                  {savingPct > 1 ? (
                    <p className="text-success text-xs font-medium">
                      Ahorra {savingPct.toFixed(0)}% frente a {formatUsd(regularCents)}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {pkg.services.map((entry) => (
                    <span
                      key={entry.serviceId}
                      className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs"
                    >
                      {entry.service.name}
                    </span>
                  ))}
                </div>

                <p className="text-muted-foreground text-xs">
                  Válido {pkg.validityDays} días · {soldCount}{" "}
                  {soldCount === 1 ? "vendido" : "vendidos"}
                </p>

                {!pkg.active ? <StatusBadge>Inactivo</StatusBadge> : null}

                <div className="mt-auto border-t pt-2">
                  <PackageDialog pkg={pkg} services={services} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="surface">
        <h2 className="flex items-center gap-2 border-b px-5 py-3 font-semibold">
          <BadgePercent className="text-muted-foreground size-4" />
          Bonos activos de clientas
        </h2>
        {activeSold.length === 0 ? (
          <p className="text-muted-foreground px-5 py-10 text-center text-sm">
            Ninguna clienta tiene bonos con saldo ahora mismo.
          </p>
        ) : (
          <ul className="divide-y">
            {sold
              .filter((entry) => entry.sessionsTotal - entry.sessionsUsed > 0)
              .map((entry) => {
                const remaining = entry.sessionsTotal - entry.sessionsUsed;
                const expiringSoon = expiresSoon(entry.expiresAt);
                return (
                  <li key={entry.id}>
                    <Link
                      href={`/panel/clientes/${entry.client.id}`}
                      className="hover:bg-accent/40 flex items-center gap-3 px-5 py-3 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{entry.client.name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {entry.package.name} · vence el{" "}
                          {fmtDate(entry.expiresAt, settings.timezone)}
                        </p>
                      </div>
                      {expiringSoon ? (
                        <StatusBadge tone="warning">Vence pronto</StatusBadge>
                      ) : null}
                      <StatusBadge tone="brand">
                        {remaining} de {entry.sessionsTotal}
                      </StatusBadge>
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/panel/page-header";
import { PeriodFilter } from "@/components/panel/period-filter";
import { StatCard } from "@/components/panel/stat-card";
import { MonthlyChart } from "@/components/panel/monthly-chart";
import { ExportButtons } from "./export-buttons";
import { getDashboard } from "@/data/dashboard";
import {
  getMonthlySummary,
  getSalesByClient,
  getSalesByService,
  getSalesBySpecialist,
} from "@/data/reports";
import { formatPercent, formatUsd, ratio } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { periodFromParams } from "@/lib/period";
import { formatPhone } from "@/lib/utils";

export const metadata = { title: "Reportes" };

export default async function ReportsPage(props: PageProps<"/panel/reportes">) {
  const params = await props.searchParams;
  const settings = await getSettings();
  const { period, preset, from, to } = periodFromParams(params, "last30", settings.timezone);

  const [dashboard, byClient, byService, bySpecialist, monthly, rateInfo] = await Promise.all([
    getDashboard(period, settings.timezone),
    getSalesByClient(period),
    getSalesByService(period),
    getSalesBySpecialist(period),
    getMonthlySummary(12, settings.timezone),
    getRate(),
  ]);

  const { kpis } = dashboard;
  const maxServiceCents = Math.max(...byService.map((s) => s.totalCents), 1);
  const maxSpecialistCents = Math.max(...bySpecialist.map((s) => s.totalCents), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description={`Análisis de ${period.label.toLowerCase()}`}
        actions={
          <ExportButtons
            period={period.label}
            clients={byClient}
            services={byService}
            specialists={bySpecialist}
            kpis={{
              ventas: kpis.salesCents,
              cobrado: kpis.collectedCents,
              costos: kpis.costsCents,
              utilidad: kpis.netProfitCents,
              margen: kpis.marginPct,
            }}
            businessName={settings.businessName}
          />
        }
      />

      <PeriodFilter current={preset} from={from} to={to} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          featured
          label="Utilidad neta"
          value={<Money cents={kpis.netProfitCents} rate={rateInfo.rate} bsClassName="text-white/60" />}
          hint={`Margen ${formatPercent(kpis.marginPct)}`}
        />
        <StatCard label="Ventas" value={<Money cents={kpis.salesCents} rate={rateInfo.rate} />} />
        <StatCard label="Cobrado" value={<Money cents={kpis.collectedCents} rate={rateInfo.rate} />} />
        <StatCard label="Costos" value={<Money cents={kpis.costsCents} rate={rateInfo.rate} />} />
      </div>

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Los últimos 12 meses</h2>
            <p className="text-muted-foreground text-xs">
              Ventas contra costos, y la utilidad que queda
            </p>
          </div>
          <div className="text-muted-foreground flex gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="bg-chart-1 size-2 rounded-full" />
              Ventas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-chart-2 size-2 rounded-full" />
              Costos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-chart-5 size-2 rounded-full" />
              Utilidad
            </span>
          </div>
        </div>
        <div className="h-64 sm:h-72">
          <MonthlyChart data={monthly} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface overflow-hidden">
          <h2 className="border-b px-5 py-3 font-semibold">Ventas por servicio</h2>
          {byService.length === 0 ? (
            <p className="text-muted-foreground px-5 py-10 text-center text-sm">
              Sin ventas en el periodo.
            </p>
          ) : (
            <ul className="divide-y">
              {byService.slice(0, 12).map((service) => (
                <li key={service.name} className="space-y-1.5 px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: service.color }}
                      />
                      <span className="truncate font-medium">{service.name}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums">
                        {formatUsd(service.totalCents)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {service.quantity} {service.quantity === 1 ? "vez" : "veces"}
                      </span>
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${ratio(service.totalCents, maxServiceCents)}%`,
                        background: service.color,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface overflow-hidden">
          <h2 className="border-b px-5 py-3 font-semibold">Ventas por especialista</h2>
          {bySpecialist.length === 0 ? (
            <p className="text-muted-foreground px-5 py-10 text-center text-sm">
              Sin ventas en el periodo.
            </p>
          ) : (
            <ul className="divide-y">
              {bySpecialist.map((specialist) => (
                <li key={specialist.name} className="space-y-1.5 px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: specialist.color }}
                      />
                      <span className="truncate font-medium">{specialist.name}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums">
                        {formatUsd(specialist.totalCents)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {specialist.count} {specialist.count === 1 ? "venta" : "ventas"}
                      </span>
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${ratio(specialist.totalCents, maxSpecialistCents)}%`,
                        background: specialist.color,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="surface overflow-hidden">
        <h2 className="flex items-center gap-2 border-b px-5 py-3 font-semibold">
          <ChartNoAxesCombined className="text-muted-foreground size-4" />
          Ventas por clienta
        </h2>
        {byClient.length === 0 ? (
          <p className="text-muted-foreground px-5 py-10 text-center text-sm">
            Sin ventas en el periodo.
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-5 py-2.5 font-medium">Clienta</th>
                    <th className="px-5 py-2.5 font-medium">Teléfono</th>
                    <th className="px-5 py-2.5 text-right font-medium">Ventas</th>
                    <th className="px-5 py-2.5 text-right font-medium">Facturado</th>
                    <th className="px-5 py-2.5 text-right font-medium">Cobrado</th>
                    <th className="px-5 py-2.5 text-right font-medium">Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byClient.map((client) => (
                    <tr key={client.id} className="hover:bg-accent/40 transition">
                      <td className="px-5 py-2.5">
                        <Link
                          href={`/panel/clientes/${client.id}`}
                          className="hover:text-primary font-medium transition"
                        >
                          {client.name}
                        </Link>
                      </td>
                      <td className="text-muted-foreground px-5 py-2.5">
                        {formatPhone(client.phone, settings.countryCode)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{client.count}</td>
                      <td className="px-5 py-2.5 text-right font-medium tabular-nums">
                        {formatUsd(client.totalCents)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {formatUsd(client.paidCents)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {client.pendingCents > 0 ? (
                          <span className="text-destructive font-medium">
                            {formatUsd(client.pendingCents)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y md:hidden">
              {byClient.map((client) => (
                <li key={client.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <Link href={`/panel/clientes/${client.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{client.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {client.count} {client.count === 1 ? "venta" : "ventas"}
                    </span>
                  </Link>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums">
                      {formatUsd(client.totalCents)}
                    </span>
                    {client.pendingCents > 0 ? (
                      <span className="text-destructive text-xs tabular-nums">
                        Debe {formatUsd(client.pendingCents)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

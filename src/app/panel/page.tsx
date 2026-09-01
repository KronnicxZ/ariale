import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  Clock,
  HandCoins,
  Receipt,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/panel/page-header";
import { PeriodFilter } from "@/components/panel/period-filter";
import { StatCard } from "@/components/panel/stat-card";
import { AppointmentStatusBadge } from "@/components/panel/status-badge";
import { SalesChart } from "@/components/panel/sales-chart";
import {
  getCategoryBreakdown,
  getDashboard,
  getSalesSeries,
  getTopServices,
} from "@/data/dashboard";
import { fmtTime, fmtDuration } from "@/lib/date";
import { formatPercent, formatUsd, ratio } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { periodFromParams } from "@/lib/period";

export const metadata = { title: "Resumen" };

export default async function DashboardPage(props: PageProps<"/panel">) {
  const params = await props.searchParams;
  const settings = await getSettings();
  const { period, preset, from, to } = periodFromParams(params, "last30", settings.timezone);

  const [data, series, categories, topServices, rateInfo] = await Promise.all([
    getDashboard(period, settings.timezone),
    getSalesSeries(period, settings.timezone),
    getCategoryBreakdown(period),
    getTopServices(period),
    getRate(),
  ]);

  const { kpis, deltas, portfolio, todayAppointments, pendingAppointments } = data;
  const rate = rateInfo.rate;
  const categoryTotal = categories.reduce((sum, c) => sum + c.totalCents, 0);

  const hour = new Date().getUTCHours() - 4;
  const greeting = hour < 12 && hour >= 5 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumen"
        description={`${greeting}. Así va ${period.label.toLowerCase()}.`}
        actions={
          <>
            <Button asChild size="sm">
              <Link href="/panel/agenda/nueva">
                <CalendarPlus className="size-4" />
                Nueva cita
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/panel/ventas/nueva">
                <Receipt className="size-4" />
                Nueva venta
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link href="/panel/clientes/nueva">
                <UserPlus className="size-4" />
                Nueva clienta
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link href="/panel/gastos/nuevo">
                <Wallet className="size-4" />
                Registrar gasto
              </Link>
            </Button>
          </>
        }
      />

      <PeriodFilter current={preset} from={from} to={to} />

      {(portfolio.overdueCount > 0 || pendingAppointments > 0) && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {portfolio.overdueCount > 0 && (
            <Link
              href="/panel/cobrar?estado=vencidas"
              className="bg-warning/10 ring-warning/25 hover:bg-warning/15 flex flex-1 items-center gap-2.5 rounded-xl px-4 py-3 text-sm ring-1 transition"
            >
              <AlertTriangle className="text-warning size-4 shrink-0" />
              <span className="flex-1">
                <strong>{portfolio.overdueCount}</strong>{" "}
                {portfolio.overdueCount === 1 ? "cuenta vencida" : "cuentas vencidas"} por cobrar
              </span>
              <ArrowRight className="text-muted-foreground size-4" />
            </Link>
          )}
          {pendingAppointments > 0 && (
            <Link
              href="/panel/agenda?estado=PENDING"
              className="bg-primary/8 ring-primary/20 hover:bg-primary/12 flex flex-1 items-center gap-2.5 rounded-xl px-4 py-3 text-sm ring-1 transition"
            >
              <Clock className="text-primary size-4 shrink-0" />
              <span className="flex-1">
                <strong>{pendingAppointments}</strong>{" "}
                {pendingAppointments === 1 ? "cita espera" : "citas esperan"} tu confirmación
              </span>
              <ArrowRight className="text-muted-foreground size-4" />
            </Link>
          )}
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          featured
          label="Utilidad neta"
          value={<Money cents={kpis.netProfitCents} rate={rate} bsClassName="text-white/60" />}
          delta={deltas.profit}
          icon={<TrendingUp className="size-4" />}
          footer={
            <div className="grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
              <div>
                <p className="text-[0.7rem] text-white/60">Margen</p>
                <p className="font-semibold">{formatPercent(kpis.marginPct)}</p>
              </div>
              <div>
                <p className="text-[0.7rem] text-white/60">Flujo de caja</p>
                <p className="font-semibold">{formatUsd(kpis.cashFlowCents, true)}</p>
              </div>
            </div>
          }
        />

        <StatCard
          label="Ventas"
          value={<Money cents={kpis.salesCents} rate={rate} />}
          hint={`${kpis.salesCount} ventas · ${kpis.clientsServed} clientas · ticket ${formatUsd(kpis.ticketAvgCents)}`}
          delta={deltas.sales}
        />

        <StatCard
          label="Cobrado"
          value={<Money cents={kpis.collectedCents} rate={rate} />}
          delta={deltas.collected}
          footer={
            <div className="space-y-1.5 pt-1">
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Tasa de cobro</span>
                <span className="font-medium">{formatPercent(kpis.collectionRatePct, 0)}</span>
              </div>
              <Progress value={Math.min(kpis.collectionRatePct, 100)} className="h-1.5" />
            </div>
          }
        />

        <StatCard
          label="Costos"
          value={<Money cents={kpis.costsCents} rate={rate} />}
          hint={`Gastos ${formatUsd(kpis.expensesCents)} · Compras ${formatUsd(kpis.purchasesCents)}`}
          delta={deltas.costs}
          invertDelta
        />
      </div>

      {/* Cartera + gráfico */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card rounded-2xl border p-4 sm:p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Ventas y cobros</h2>
              <p className="text-muted-foreground text-xs">
                Lo facturado contra lo que realmente entró en caja
              </p>
            </div>
            <div className="text-muted-foreground flex shrink-0 gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="bg-chart-1 size-2 rounded-full" />
                Ventas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-chart-5 size-2 rounded-full" />
                Cobrado
              </span>
            </div>
          </div>
          <div className="h-56 sm:h-64">
            <SalesChart data={series} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-card rounded-2xl border p-4 sm:p-5">
            <h2 className="mb-3 font-semibold">Cartera</h2>
            <div className="space-y-3">
              <Link
                href="/panel/cobrar"
                className="hover:bg-accent/50 -mx-2 flex items-center justify-between rounded-xl px-2 py-2 transition"
              >
                <span className="flex items-center gap-2 text-sm">
                  <HandCoins className="text-muted-foreground size-4" />
                  Por cobrar
                </span>
                <Money
                  cents={portfolio.receivableCents}
                  rate={rate}
                  className="items-end text-sm font-semibold"
                />
              </Link>
              <Link
                href="/panel/pagar"
                className="hover:bg-accent/50 -mx-2 flex items-center justify-between rounded-xl px-2 py-2 transition"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Wallet className="text-muted-foreground size-4" />
                  Por pagar
                </span>
                <Money
                  cents={portfolio.payableCents}
                  rate={rate}
                  className="items-end text-sm font-semibold"
                />
              </Link>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium">Posición neta</span>
                <span
                  className={
                    portfolio.receivableCents - portfolio.payableCents >= 0
                      ? "text-success text-sm font-semibold tabular-nums"
                      : "text-destructive text-sm font-semibold tabular-nums"
                  }
                >
                  {formatUsd(portfolio.receivableCents - portfolio.payableCents)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border p-4 sm:p-5">
            <h2 className="mb-3 font-semibold">Por categoría</h2>
            {categories.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin ventas en el periodo.</p>
            ) : (
              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: category.color }}
                        />
                        {category.name}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatUsd(category.totalCents)}
                      </span>
                    </div>
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${ratio(category.totalCents, categoryTotal)}%`,
                          background: category.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agenda de hoy + top servicios */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card rounded-2xl border lg:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div>
              <h2 className="font-semibold">Agenda de hoy</h2>
              <p className="text-muted-foreground text-xs">
                {todayAppointments.length === 0
                  ? "Sin citas para hoy"
                  : `${todayAppointments.length} ${todayAppointments.length === 1 ? "cita" : "citas"}`}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/panel/agenda">
                Ver agenda
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {todayAppointments.length === 0 ? (
            <p className="text-muted-foreground px-5 py-10 text-center text-sm">
              Hoy no hay nada agendado. Buen momento para llamar a las clientas que no vienen hace
              rato.
            </p>
          ) : (
            <ul className="divide-y">
              {todayAppointments.map((appt) => {
                const total = appt.services.reduce((sum, s) => sum + s.priceCents, 0);
                const duration = appt.services.reduce((sum, s) => sum + s.durationMin, 0);
                return (
                  <li key={appt.id}>
                    <Link
                      href={`/panel/agenda/${appt.id}`}
                      className="hover:bg-accent/40 flex items-center gap-3 px-4 py-3 transition sm:px-5"
                    >
                      <div className="w-16 shrink-0 text-center">
                        <p className="text-sm font-semibold tabular-nums">
                          {fmtTime(appt.startAt, settings.timezone)}
                        </p>
                        <p className="text-muted-foreground text-[0.7rem]">
                          {fmtDuration(duration)}
                        </p>
                      </div>
                      <span
                        className="h-10 w-1 shrink-0 rounded-full"
                        style={{ background: appt.specialist.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{appt.client.name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {appt.services.map((s) => s.service.name).join(" + ")}
                        </p>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-sm font-medium tabular-nums">{formatUsd(total)}</p>
                        <p className="text-muted-foreground text-[0.7rem]">
                          {appt.specialist.name}
                        </p>
                      </div>
                      <AppointmentStatusBadge status={appt.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-card rounded-2xl border p-4 sm:p-5">
          <h2 className="mb-3 font-semibold">Servicios que más dejan</h2>
          {topServices.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin datos en el periodo.</p>
          ) : (
            <ol className="space-y-3">
              {topServices.map((service, index) => (
                <li key={service.id} className="flex items-center gap-3">
                  <span className="bg-muted text-muted-foreground grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{service.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {service.quantity} {service.quantity === 1 ? "vez" : "veces"} ·{" "}
                      {service.category}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatUsd(service.totalCents, true)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

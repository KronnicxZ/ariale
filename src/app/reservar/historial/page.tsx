import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentClient } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getRate } from "@/lib/rate";
import { AppointmentStatusBadge } from "@/components/panel/status-badge";
import { fmtDate, fmtTime } from "@/lib/date";
import { formatBs, formatUsd } from "@/lib/money";

export const metadata = { title: "Tus visitas" };

export default async function ClientHistoryPage() {
  const client = await getCurrentClient();
  if (!client) redirect("/reservar");

  const [settings, rateInfo] = await Promise.all([getSettings(), getRate()]);

  const [upcoming, past, sales] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clientId: client.id,
        startAt: { gte: new Date() },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      orderBy: { startAt: "asc" },
      include: { services: { include: { service: { select: { name: true } } } } },
    }),
    prisma.appointment.findMany({
      where: { clientId: client.id, startAt: { lt: new Date() } },
      orderBy: { startAt: "desc" },
      take: 30,
      include: {
        specialist: { select: { name: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
    prisma.sale.findMany({
      where: { clientId: client.id, status: { not: "CANCELLED" } },
      select: { totalCents: true, paidCents: true },
    }),
  ]);

  const totalSpentCents = sales.reduce((sum, s) => sum + s.paidCents, 0);
  const balanceCents = sales.reduce((sum, s) => sum + s.totalCents - s.paidCents, 0);
  const visitCount = past.filter((a) => a.status === "ATTENDED").length;

  return (
    <div className="mx-auto w-full max-w-md flex-1 px-5 py-5">
      <Link
        href="/reservar"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition"
      >
        <ArrowLeft className="size-4" />
        Inicio
      </Link>

      <h1 className="font-display text-2xl font-semibold">Tus visitas</h1>
      <p className="text-muted-foreground mt-0.5 text-sm">
        Historial y consumo con {settings.businessName}.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="menu-gradient rounded-2xl p-4 text-white">
          <p className="text-xs text-white/60">Total gastado</p>
          <p className="font-numeric mt-1 text-2xl font-semibold">
            {formatUsd(totalSpentCents)}
          </p>
          {rateInfo.rate ? (
            <p className="mt-0.5 text-[0.7rem] text-white/50">
              {formatBs(totalSpentCents, rateInfo.rate)}
            </p>
          ) : null}
        </div>
        <div className="surface p-4">
          <p className="text-muted-foreground text-xs">Visitas</p>
          <p className="font-numeric mt-1 text-2xl font-semibold">{visitCount}</p>
          {balanceCents > 0 ? (
            <p className="text-destructive mt-0.5 text-[0.7rem]">
              Saldo: {formatUsd(balanceCents)}
            </p>
          ) : (
            <p className="text-muted-foreground mt-0.5 text-[0.7rem]">Sin saldo pendiente</p>
          )}
        </div>
      </div>

      {upcoming.length > 0 ? (
        <section className="mt-7">
          <h2 className="mb-2 text-sm font-semibold">Próximas citas</h2>
          <ul className="space-y-2">
            {upcoming.map((appointment) => (
              <li
                key={appointment.id}
                className="surface flex items-start justify-between gap-3 p-3.5"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {fmtDate(appointment.startAt, settings.timezone)} ·{" "}
                    {fmtTime(appointment.startAt, settings.timezone)}
                  </span>
                  <span className="text-muted-foreground block text-sm">
                    {appointment.services.map((s) => s.service.name).join(" + ")}
                  </span>
                </span>
                <AppointmentStatusBadge status={appointment.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-7">
        <h2 className="mb-2 text-sm font-semibold">Visitas anteriores</h2>
        {past.length === 0 ? (
          <p className="text-muted-foreground border-border/70 rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
            Todavía no tienes visitas registradas.
          </p>
        ) : (
          <ul className="space-y-2">
            {past.map((appointment) => {
              const totalCents = appointment.services.reduce((sum, s) => sum + s.priceCents, 0);
              return (
                <li key={appointment.id} className="surface p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {fmtDate(appointment.startAt, settings.timezone)}
                      </span>
                      <span className="text-muted-foreground block text-sm">
                        {appointment.services.map((s) => s.service.name).join(" + ")}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        Con {appointment.specialist.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums">
                        {formatUsd(totalCents)}
                      </span>
                      <AppointmentStatusBadge status={appointment.status} />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Button asChild className="mt-7 h-12 w-full text-base">
        <Link href="/reservar/nueva">
          <CalendarPlus className="size-5" />
          Agendar otra cita
        </Link>
      </Button>
    </div>
  );
}

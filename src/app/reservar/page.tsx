import Link from "next/link";
import { CalendarPlus, ChevronRight, ClipboardList, Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentClient } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getRate } from "@/lib/rate";
import { AppointmentStatusBadge } from "@/components/panel/status-badge";
import { fmtDayShort, fmtTime } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { firstName } from "@/lib/utils";
import { IdentifyForm } from "./identify-form";
import { clientCancelAppointmentAction } from "@/actions/client-zone";

export const metadata = { title: "Agenda tu cita" };

export default async function ReservarPage() {
  const [client, settings] = await Promise.all([getCurrentClient(), getSettings()]);

  if (!client) {
    return (
      <IdentifyForm business={settings.businessName} countryCode={settings.countryCode} />
    );
  }

  const [upcoming, packages, rateInfo] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clientId: client.id,
        startAt: { gte: new Date() },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      orderBy: { startAt: "asc" },
      include: {
        specialist: { select: { name: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
    prisma.clientPackage.findMany({
      where: { clientId: client.id, status: "ACTIVE", expiresAt: { gte: new Date() } },
      include: { package: { select: { name: true } } },
    }),
    getRate(),
  ]);

  const activePackages = packages.filter((p) => p.sessionsTotal - p.sessionsUsed > 0);

  return (
    <div className="soft-blush flex-1 px-5 py-7">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl font-semibold">Hola, {firstName(client.name)}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Agenda tu cita en {settings.businessName} o consulta tu historial.
        </p>

        <div className="mt-6 space-y-3">
          <Link
            href="/reservar/nueva"
            className="brand-gradient text-primary-foreground flex items-center gap-4 rounded-2xl p-4 shadow-sm transition active:scale-[0.99]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-black/10">
              <CalendarPlus className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Agendar cita</span>
              <span className="block text-sm opacity-80">Elige servicio y horario.</span>
            </span>
            <ChevronRight className="size-5 shrink-0 opacity-70" />
          </Link>

          <Link
            href="/reservar/historial"
            className="surface flex items-center gap-4 p-4 transition active:scale-[0.99]"
          >
            <span className="bg-primary/12 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
              <ClipboardList className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Mi historial</span>
              <span className="text-muted-foreground block text-sm">
                Visitas anteriores y cuánto has gastado.
              </span>
            </span>
            <ChevronRight className="text-muted-foreground size-5 shrink-0" />
          </Link>
        </div>

        {activePackages.length > 0 ? (
          <section className="mt-7">
            <h2 className="mb-2 text-sm font-semibold">Tus bonos</h2>
            <ul className="space-y-2">
              {activePackages.map((entry) => {
                const remaining = entry.sessionsTotal - entry.sessionsUsed;
                return (
                  <li
                    key={entry.id}
                    className="surface flex items-center justify-between gap-3 p-3.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {entry.package.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        Vence el {fmtDayShort(entry.expiresAt, settings.timezone)}
                      </span>
                    </span>
                    <span className="bg-primary/12 text-primary shrink-0 rounded-full px-3 py-1 text-sm font-semibold">
                      {remaining} {remaining === 1 ? "sesión" : "sesiones"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="mt-7">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Próximas citas</h2>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
              {upcoming.length}
            </span>
          </div>

          {upcoming.length === 0 ? (
            <p className="text-muted-foreground border-border/70 rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
              No tienes citas agendadas. ¡Anímate a reservar!
            </p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((appointment) => {
                const totalCents = appointment.services.reduce((sum, s) => sum + s.priceCents, 0);
                return (
                  <li key={appointment.id} className="surface p-3.5">
                    <div className="flex gap-3.5">
                      <div className="bg-primary/10 text-primary w-14 shrink-0 rounded-xl py-2 text-center">
                        <p className="text-[0.65rem] font-medium uppercase">
                          {fmtDayShort(appointment.startAt, settings.timezone).split(" ")[2]}
                        </p>
                        <p className="font-numeric text-xl leading-tight font-semibold">
                          {fmtDayShort(appointment.startAt, settings.timezone).split(" ")[1]}
                        </p>
                        <p className="text-[0.6rem] capitalize">
                          {fmtDayShort(appointment.startAt, settings.timezone).split(" ")[0]}
                        </p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 text-sm font-semibold">
                            <Clock className="text-muted-foreground size-3.5" />
                            {fmtTime(appointment.startAt, settings.timezone)}
                          </span>
                          <AppointmentStatusBadge status={appointment.status} />
                        </div>
                        <p className="mt-0.5 text-sm">
                          {appointment.services.map((s) => s.service.name).join(" + ")}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Con {appointment.specialist.name} · {formatUsd(totalCents)}
                        </p>
                      </div>
                    </div>

                    <form action={clientCancelAppointmentAction} className="mt-2.5 border-t pt-2.5">
                      <input type="hidden" name="id" value={appointment.id} />
                      <button
                        type="submit"
                        className="text-destructive text-sm font-medium transition hover:underline"
                      >
                        Cancelar cita
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {rateInfo.rate > 0 ? (
          <p className="text-muted-foreground mt-8 text-center text-xs">
            Los precios se muestran en dólares y en bolívares a la tasa BCV del día
            ({rateInfo.rate.toFixed(2)} Bs.).
          </p>
        ) : null}
      </div>
    </div>
  );
}

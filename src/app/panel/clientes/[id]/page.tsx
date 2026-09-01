import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgePercent,
  CalendarPlus,
  Cake,
  AtSign,
  Mail,
  MessageCircle,
  Pencil,
  Receipt,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import {
  AppointmentStatusBadge,
  SaleStatusBadge,
  StatusBadge,
} from "@/components/panel/status-badge";
import { getClientProfile } from "@/data/clients";
import { fmtDate, fmtDayLong, fmtRelativeDay, fmtTime } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { formatPhone, initials } from "@/lib/utils";
import { nextSessionMessage, waLink } from "@/lib/whatsapp";
import { toggleClientActiveAction } from "@/actions/clients";

export async function generateMetadata(props: PageProps<"/panel/clientes/[id]">) {
  const { id } = await props.params;
  const profile = await getClientProfile(id);
  return { title: profile?.client.name ?? "Clienta" };
}

export default async function ClientProfilePage(props: PageProps<"/panel/clientes/[id]">) {
  const { id } = await props.params;
  const [profile, settings, rateInfo] = await Promise.all([
    getClientProfile(id),
    getSettings(),
    getRate(),
  ]);
  if (!profile) notFound();

  const { client, stats, upcoming, dueSessions } = profile;
  const now = new Date();
  const overdueSessions = dueSessions.filter((s) => s.dueAt <= now);
  const activePackages = client.packages.filter(
    (p) => p.status === "ACTIVE" && p.sessionsTotal - p.sessionsUsed > 0,
  );

  return (
    <div className="space-y-5">
      <Link
        href="/panel/clientes"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition"
      >
        <ArrowLeft className="size-4" />
        Volver a clientas
      </Link>

      <div className="bg-card rounded-2xl border p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="bg-primary/12 text-primary grid size-14 shrink-0 place-items-center rounded-full text-lg font-semibold">
              {initials(client.name)}
            </span>
            <div className="min-w-0">
              <h1 className="font-heading text-2xl font-semibold">{client.name}</h1>
              <p className="text-muted-foreground text-sm">
                {formatPhone(client.phone, settings.countryCode)}
              </p>
              <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {client.email ? (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3" />
                    {client.email}
                  </span>
                ) : null}
                {client.instagram ? (
                  <span className="inline-flex items-center gap-1">
                    <AtSign className="size-3" />@{client.instagram}
                  </span>
                ) : null}
                {client.birthday ? (
                  <span className="inline-flex items-center gap-1">
                    <Cake className="size-3" />
                    {fmtDate(client.birthday, "UTC")}
                  </span>
                ) : null}
                <span>Clienta desde {fmtDate(client.createdAt, settings.timezone)}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/panel/agenda/nueva?clienta=${client.id}`}>
                <CalendarPlus className="size-4" />
                Agendar
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/panel/clientes/${client.id}/editar`}>
                <Pencil className="size-4" />
                Editar
              </Link>
            </Button>
            <form action={toggleClientActiveAction}>
              <input type="hidden" name="id" value={client.id} />
              <Button type="submit" size="sm" variant="ghost">
                {client.active ? "Desactivar" : "Reactivar"}
              </Button>
            </form>
          </div>
        </div>

        {client.allergies ? (
          <p className="bg-warning/10 text-warning-foreground mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm">
            <ShieldAlert className="text-warning mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Ojo:</strong> {client.allergies}
            </span>
          </p>
        ) : null}

        {client.notes ? (
          <p className="bg-muted/60 mt-3 rounded-xl px-3 py-2.5 text-sm">{client.notes}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-card rounded-2xl border p-4">
          <p className="text-muted-foreground text-xs uppercase">Visitas</p>
          <p className="font-heading text-2xl font-semibold">{stats.visits}</p>
          <p className="text-muted-foreground text-xs">
            {stats.lastVisitAt
              ? `Última ${fmtRelativeDay(stats.lastVisitAt, settings.timezone)}`
              : "Sin visitas aún"}
          </p>
        </div>
        <div className="bg-card rounded-2xl border p-4">
          <p className="text-muted-foreground text-xs uppercase">Total gastado</p>
          <Money
            cents={stats.totalSpentCents}
            rate={rateInfo.rate}
            className="font-heading text-2xl font-semibold"
          />
        </div>
        <div className="bg-card rounded-2xl border p-4">
          <p className="text-muted-foreground text-xs uppercase">Ticket promedio</p>
          <p className="font-heading text-2xl font-semibold">
            {formatUsd(stats.ticketAvgCents)}
          </p>
        </div>
        <div
          className={
            stats.balanceCents > 0
              ? "menu-gradient rounded-2xl p-4 text-white"
              : "bg-card rounded-2xl border p-4"
          }
        >
          <p
            className={
              stats.balanceCents > 0 ? "text-xs text-white/60 uppercase" : "text-muted-foreground text-xs uppercase"
            }
          >
            Saldo pendiente
          </p>
          <p className="font-heading text-2xl font-semibold">{formatUsd(stats.balanceCents)}</p>
          {stats.balanceCents > 0 ? (
            <Link href="/panel/cobrar" className="text-xs text-white/70 underline">
              Ver cuentas por cobrar
            </Link>
          ) : (
            <p className="text-muted-foreground text-xs">Todo al día</p>
          )}
        </div>
      </div>

      {overdueSessions.length > 0 ? (
        <div className="bg-primary/8 ring-primary/20 rounded-2xl p-4 ring-1">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Timer className="text-primary size-4" />
            Le toca repetir
          </h2>
          <ul className="space-y-2">
            {overdueSessions.map((session) => (
              <li
                key={session.serviceName}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  <strong>{session.serviceName}</strong>
                  <span className="text-muted-foreground">
                    {" "}
                    · última vez {fmtRelativeDay(session.lastAt, settings.timezone)}
                  </span>
                </span>
                <a
                  href={waLink(
                    client.phone,
                    nextSessionMessage(client.name, session.serviceName, settings.businessName),
                    settings.countryCode,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-success/12 text-success hover:bg-success/20 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition"
                >
                  <MessageCircle className="size-3.5" />
                  Recordarle
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {activePackages.length > 0 ? (
        <section className="bg-card rounded-2xl border p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <BadgePercent className="text-muted-foreground size-4" />
            Bonos activos
          </h2>
          <ul className="space-y-2.5">
            {activePackages.map((entry) => {
              const remaining = entry.sessionsTotal - entry.sessionsUsed;
              const usedPct = (entry.sessionsUsed / entry.sessionsTotal) * 100;
              return (
                <li key={entry.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{entry.package.name}</span>
                    <StatusBadge tone="brand">
                      {remaining} de {entry.sessionsTotal}
                    </StatusBadge>
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div className="bg-primary h-full" style={{ width: `${usedPct}%` }} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Vence el {fmtDate(entry.expiresAt, settings.timezone)} ·{" "}
                    {entry.package.services.map((s) => s.service.name).join(", ")}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="bg-card rounded-2xl border">
          <h2 className="border-b px-5 py-3 font-semibold">Próximas citas</h2>
          <ul className="divide-y">
            {upcoming.map((appointment) => (
              <li key={appointment.id}>
                <Link
                  href={`/panel/agenda/${appointment.id}`}
                  className="hover:bg-accent/40 flex items-center gap-3 px-5 py-3 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">
                      {fmtDayLong(appointment.startAt, settings.timezone)} ·{" "}
                      {fmtTime(appointment.startAt, settings.timezone)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {appointment.services.map((s) => s.service.name).join(" + ")} ·{" "}
                      {appointment.specialist.name}
                    </p>
                  </div>
                  <AppointmentStatusBadge status={appointment.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="bg-card rounded-2xl border">
        <h2 className="border-b px-5 py-3 font-semibold">Historial de visitas</h2>
        {client.appointments.length === 0 ? (
          <p className="text-muted-foreground px-5 py-10 text-center text-sm">
            Todavía no tiene visitas registradas.
          </p>
        ) : (
          <ul className="divide-y">
            {client.appointments.slice(0, 40).map((appointment) => {
              const totalCents = appointment.services.reduce((sum, s) => sum + s.priceCents, 0);
              return (
                <li key={appointment.id}>
                  <Link
                    href={`/panel/agenda/${appointment.id}`}
                    className="hover:bg-accent/40 flex items-center gap-3 px-5 py-3 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {fmtDate(appointment.startAt, settings.timezone)}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {appointment.services.map((s) => s.service.name).join(" + ")}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatUsd(totalCents)}
                    </span>
                    <AppointmentStatusBadge status={appointment.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="bg-card rounded-2xl border">
        <h2 className="flex items-center gap-2 border-b px-5 py-3 font-semibold">
          <Receipt className="text-muted-foreground size-4" />
          Ventas
        </h2>
        {client.sales.length === 0 ? (
          <p className="text-muted-foreground px-5 py-10 text-center text-sm">
            No hay ventas registradas.
          </p>
        ) : (
          <ul className="divide-y">
            {client.sales.map((sale) => (
              <li key={sale.id}>
                <Link
                  href={`/panel/ventas/${sale.id}`}
                  className="hover:bg-accent/40 flex items-center gap-3 px-5 py-3 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Venta #{sale.number}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {fmtDate(sale.date, settings.timezone)} ·{" "}
                      {sale.items.map((i) => i.description).join(", ")}
                    </p>
                  </div>
                  <span className="text-right text-sm">
                    <span className="block font-medium tabular-nums">
                      {formatUsd(sale.totalCents)}
                    </span>
                    {sale.paidCents < sale.totalCents ? (
                      <span className="text-destructive text-xs tabular-nums">
                        Debe {formatUsd(sale.totalCents - sale.paidCents)}
                      </span>
                    ) : null}
                  </span>
                  <SaleStatusBadge status={sale.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

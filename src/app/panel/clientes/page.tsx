import Link from "next/link";
import { CalendarPlus, MessageCircle, UserPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { StatusBadge } from "@/components/panel/status-badge";
import { ClientFilters } from "./client-filters";
import { getClients, type ClientFilter, type ClientSort } from "@/data/clients";
import { fmtRelativeDay } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { stringParam } from "@/lib/period";
import { formatPhone, initials } from "@/lib/utils";
import { bookingLinkMessage, waLink } from "@/lib/whatsapp";

export const metadata = { title: "Clientas" };

const FILTERS = new Set([
  "todas",
  "activas",
  "inactivas",
  "con-cita",
  "con-saldo",
  "nuevas",
  "con-bono",
]);
const SORTS = new Set(["recientes", "nombre", "gasto", "ultima-visita"]);

export default async function ClientsPage(props: PageProps<"/panel/clientes">) {
  const params = await props.searchParams;
  const settings = await getSettings();

  const query = stringParam(params, "q");
  const rawFilter = stringParam(params, "filtro");
  const rawSort = stringParam(params, "orden");
  const filter = (rawFilter && FILTERS.has(rawFilter) ? rawFilter : "todas") as ClientFilter;
  const sort = (rawSort && SORTS.has(rawSort) ? rawSort : "recientes") as ClientSort;

  const { clients, stats } = await getClients({ query, filter, sort });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientas"
        description="Directorio del estudio"
        actions={
          <Button asChild size="sm">
            <Link href="/panel/clientes/nueva">
              <UserPlus className="size-4" />
              Nueva clienta
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Clientas", value: stats.total, hint: "En el directorio" },
          { label: "Activas", value: stats.active, hint: "Disponibles para agendar" },
          { label: "Nuevas del mes", value: stats.newThisMonth, hint: "Últimos 30 días" },
          { label: "Con saldo", value: stats.withBalance, hint: "Cuentas abiertas", featured: true },
        ].map((stat) => (
          <div
            key={stat.label}
            className={
              stat.featured
                ? "menu-gradient rounded-xl px-3 py-2.5 text-white"
                : "bg-card rounded-xl border px-3 py-2.5"
            }
          >
            <p
              className={
                stat.featured
                  ? "text-[0.7rem] text-white/60 uppercase"
                  : "text-muted-foreground text-[0.7rem] uppercase"
              }
            >
              {stat.label}
            </p>
            <p className="font-heading text-xl font-semibold">{stat.value}</p>
            <p
              className={
                stat.featured ? "text-[0.68rem] text-white/50" : "text-muted-foreground text-[0.68rem]"
              }
            >
              {stat.hint}
            </p>
          </div>
        ))}
      </div>

      <ClientFilters query={query} filter={filter} sort={sort} />

      {clients.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-8" />}
          title={query ? "No encontramos a nadie" : "Todavía no hay clientas"}
          description={
            query
              ? "Prueba con otro nombre o teléfono."
              : "Registra la primera y empieza a llevar su historial."
          }
          action={
            <Button asChild size="sm">
              <Link href="/panel/clientes/nueva">
                <UserPlus className="size-4" />
                Nueva clienta
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {clients.length} {clients.length === 1 ? "clienta" : "clientas"}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <article
                key={client.id}
                className="bg-card relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-4"
              >
                {!client.active ? (
                  <span className="bg-muted text-muted-foreground absolute top-3 right-3 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold">
                    Inactiva
                  </span>
                ) : null}

                <div className="flex items-start gap-3">
                  <span className="bg-primary/12 text-primary grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold">
                    {initials(client.name)}
                  </span>
                  <div className="min-w-0 flex-1 pr-14">
                    <Link
                      href={`/panel/clientes/${client.id}`}
                      className="hover:text-primary block truncate font-medium transition"
                    >
                      {client.name}
                    </Link>
                    <p className="text-muted-foreground truncate text-xs">
                      {formatPhone(client.phone, settings.countryCode)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-y py-2.5 text-center">
                  <div>
                    <p className="text-muted-foreground text-[0.65rem] uppercase">Visitas</p>
                    <p className="text-sm font-semibold">{client.salesCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[0.65rem] uppercase">Gastado</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatUsd(client.totalSpentCents, true)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[0.65rem] uppercase">Última</p>
                    <p className="text-sm font-semibold">
                      {client.lastVisitAt
                        ? fmtRelativeDay(client.lastVisitAt, settings.timezone)
                        : "—"}
                    </p>
                  </div>
                </div>

                {(client.balanceCents > 0 ||
                  client.upcomingCount > 0 ||
                  client.packageSessions > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {client.balanceCents > 0 ? (
                      <StatusBadge tone="danger">
                        Debe {formatUsd(client.balanceCents)}
                      </StatusBadge>
                    ) : null}
                    {client.upcomingCount > 0 ? (
                      <StatusBadge tone="success">
                        {client.upcomingCount} cita{client.upcomingCount === 1 ? "" : "s"}
                      </StatusBadge>
                    ) : null}
                    {client.packageSessions > 0 ? (
                      <StatusBadge tone="brand">
                        {client.packageSessions} sesion
                        {client.packageSessions === 1 ? "" : "es"} de bono
                      </StatusBadge>
                    ) : null}
                  </div>
                )}

                <div className="mt-auto flex gap-1.5">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link href={`/panel/clientes/${client.id}`}>Ver ficha</Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/panel/agenda/nueva?clienta=${client.id}`}>
                      <CalendarPlus className="size-3.5" />
                      Agendar
                    </Link>
                  </Button>
                  <a
                    href={waLink(
                      client.phone,
                      bookingLinkMessage(`${baseUrl}/reservar`, settings.businessName),
                      settings.countryCode,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-success/12 text-success hover:bg-success/20 grid size-8 shrink-0 place-items-center rounded-lg transition"
                    aria-label={`Escribir a ${client.name}`}
                  >
                    <MessageCircle className="size-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

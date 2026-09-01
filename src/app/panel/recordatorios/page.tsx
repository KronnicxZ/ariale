import Link from "next/link";
import { BellRing, Cake, CheckCheck, Clock, HandCoins, MessageCircle, Timer } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { StatusBadge } from "@/components/panel/status-badge";
import { getReminders, type ReminderItem } from "@/data/reminders";
import { fmtDayShort, fmtRelativeDay, fmtTime } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { initials } from "@/lib/utils";
import {
  appointmentReminderMessage,
  birthdayMessage,
  debtMessage,
  nextSessionMessage,
  waLink,
} from "@/lib/whatsapp";
import { markReminderAction } from "@/actions/reminders";
import { cn } from "@/lib/utils";

export const metadata = { title: "Recordatorios" };

const ICONS = {
  APPOINTMENT: Clock,
  NEXT_SESSION: Timer,
  DEBT: HandCoins,
  BIRTHDAY: Cake,
} as const;

const GROUP_LABELS = {
  APPOINTMENT: "Citas de las próximas 48 horas",
  NEXT_SESSION: "Les toca repetir sesión",
  DEBT: "Saldos vencidos",
  BIRTHDAY: "Cumpleaños de hoy",
} as const;

export default async function RemindersPage() {
  const [settings, rateInfo] = await Promise.all([getSettings(), getRate()]);
  const { pending, counts } = await getReminders(settings.timezone);

  const buildMessage = (item: ReminderItem) => {
    switch (item.kind) {
      case "APPOINTMENT":
        return appointmentReminderMessage(
          {
            startAt: item.when!,
            client: { name: item.clientName },
            services: [{ service: { name: item.detail } }],
          },
          settings.businessName,
        );
      case "NEXT_SESSION":
        return nextSessionMessage(item.clientName, item.serviceName!, settings.businessName);
      case "DEBT":
        return debtMessage(
          item.clientName,
          item.amountCents ?? 0,
          settings.businessName,
          rateInfo.rate,
        );
      case "BIRTHDAY":
        return birthdayMessage(item.clientName, settings.businessName);
    }
  };

  const groups = (["APPOINTMENT", "DEBT", "NEXT_SESSION", "BIRTHDAY"] as const)
    .map((kind) => ({ kind, items: pending.filter((item) => item.kind === kind) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recordatorios"
        description="Lo que conviene escribirle hoy a tus clientas"
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Citas", value: counts.appointments, icon: Clock },
          { label: "Saldos", value: counts.debts, icon: HandCoins },
          { label: "Repetir sesión", value: counts.sessions, icon: Timer },
          { label: "Cumpleaños", value: counts.birthdays, icon: Cake },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl border px-3 py-2.5">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[0.7rem] uppercase">
              <stat.icon className="size-3.5" />
              {stat.label}
            </p>
            <p className="font-heading text-xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <p className="bg-muted/50 text-muted-foreground rounded-xl px-4 py-3 text-sm">
        La app arma el mensaje y te abre WhatsApp con un toque. Nada se envía solo, así siempre
        controlas qué se dice.
      </p>

      {pending.length === 0 ? (
        <EmptyState
          icon={<BellRing className="size-8" />}
          title="Todo al día"
          description="No hay nada pendiente de recordar. Vuelve mañana."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const Icon = ICONS[group.kind];
            return (
              <section key={group.kind} className="space-y-2.5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Icon className="text-muted-foreground size-4" />
                  {GROUP_LABELS[group.kind]}
                  <span className="text-muted-foreground text-sm font-normal">
                    ({group.items.length})
                  </span>
                </h2>

                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.key}
                      className={cn(
                        "bg-card flex flex-wrap items-center gap-3 rounded-2xl border p-3.5",
                        item.urgent && "border-warning/45",
                      )}
                    >
                      <span className="bg-primary/12 text-primary grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold">
                        {initials(item.clientName)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/panel/clientes/${item.clientId}`}
                          className="hover:text-primary block truncate font-medium transition"
                        >
                          {item.clientName}
                        </Link>
                        <p className="text-muted-foreground truncate text-xs">
                          {item.detail}
                          {item.amountCents ? ` · ${formatUsd(item.amountCents)}` : ""}
                        </p>
                        {item.when ? (
                          <p className="text-muted-foreground text-xs">
                            {item.kind === "APPOINTMENT"
                              ? `${fmtRelativeDay(item.when, settings.timezone)} a las ${fmtTime(item.when, settings.timezone)}`
                              : item.kind === "DEBT"
                                ? `Venció el ${fmtDayShort(item.when, settings.timezone)}`
                                : `Tocaba el ${fmtDayShort(item.when, settings.timezone)}`}
                          </p>
                        ) : null}
                      </div>

                      {item.urgent ? <StatusBadge tone="warning">Urgente</StatusBadge> : null}

                      <div className="flex shrink-0 gap-2">
                        <a
                          href={waLink(item.clientPhone, buildMessage(item), settings.countryCode)}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-success/12 text-success hover:bg-success/20 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition"
                        >
                          <MessageCircle className="size-4" />
                          Escribir
                        </a>
                        <form action={markReminderAction}>
                          <input type="hidden" name="kind" value={item.kind} />
                          <input type="hidden" name="clientId" value={item.clientId} />
                          {item.appointmentId ? (
                            <input
                              type="hidden"
                              name="appointmentId"
                              value={item.appointmentId}
                            />
                          ) : null}
                          <input type="hidden" name="note" value={item.serviceName ?? ""} />
                          <button
                            type="submit"
                            className="bg-secondary text-secondary-foreground hover:bg-accent flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition"
                            title="Marcar como hecho"
                          >
                            <CheckCheck className="size-4" />
                            <span className="sr-only sm:not-sr-only">Hecho</span>
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

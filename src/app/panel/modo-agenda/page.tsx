import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, getWorkingHours } from "@/lib/settings";
import { getDayAgenda, getWeekStrip } from "@/data/agenda";
import { dayKey } from "@/lib/date";
import { stringParam } from "@/lib/period";
import { AgendaBoard } from "./agenda-board";

export const metadata = { title: "Modo agenda" };

export default async function AgendaModePage(props: PageProps<"/panel/modo-agenda">) {
  if (!(await getCurrentUser())) redirect("/login");

  const params = await props.searchParams;
  const [settings, hours] = await Promise.all([getSettings(), getWorkingHours()]);

  const today = dayKey(new Date(), settings.timezone);
  const day = stringParam(params, "dia") ?? today;
  const specialistId = stringParam(params, "especialista");

  const [{ appointments, specialists, counts }, strip] = await Promise.all([
    getDayAgenda({ day, tz: settings.timezone }),
    getWeekStrip(day, settings.timezone),
  ]);

  const [y, m, d] = day.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const schedule = hours.find((h) => h.dayOfWeek === dayOfWeek);

  return (
    <AgendaBoard
      day={day}
      today={today}
      strip={strip}
      counts={counts}
      specialists={specialists}
      specialistId={specialistId}
      openTime={schedule?.enabled ? schedule.openTime : "09:00"}
      closeTime={schedule?.enabled ? schedule.closeTime : "18:00"}
      closed={!schedule?.enabled}
      timezone={settings.timezone}
      appointments={appointments.map((appointment) => ({
        id: appointment.id,
        specialistId: appointment.specialistId,
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        status: appointment.status,
        note: appointment.note,
        clientName: appointment.client.name,
        services: appointment.services.map((s) => s.service.name),
        totalCents: appointment.services.reduce((sum, s) => sum + s.priceCents, 0),
      }))}
    />
  );
}

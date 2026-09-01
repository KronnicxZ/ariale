import "server-only";
import { prisma } from "@/lib/db";
import { TZ, dayKey } from "@/lib/date";

/**
 * Todo lo que conviene recordarle a una clienta hoy. No se envía nada solo:
 * la app arma el mensaje y la dueña lo manda con un toque desde WhatsApp.
 */

export type ReminderItem = {
  key: string;
  kind: "APPOINTMENT" | "NEXT_SESSION" | "BIRTHDAY" | "DEBT";
  clientId: string;
  clientName: string;
  clientPhone: string;
  title: string;
  detail: string;
  appointmentId?: string;
  amountCents?: number;
  serviceName?: string;
  when?: Date;
  urgent: boolean;
  alreadySent: boolean;
};

export async function getReminders(tz = TZ) {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3_600_000);
  const todayKey = dayKey(now, tz);

  const [appointments, debts, birthdays, recentLogs, depilationHistory] = await Promise.all([
    // Citas de las próximas 48 horas
    prisma.appointment.findMany({
      where: {
        startAt: { gte: now, lte: in48h },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      orderBy: { startAt: "asc" },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),

    // Deudas vencidas
    prisma.sale.findMany({
      where: { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: now } },
      orderBy: { dueDate: "asc" },
      include: { client: { select: { id: true, name: true, phone: true } } },
    }),

    prisma.client.findMany({
      where: { active: true, birthday: { not: null } },
      select: { id: true, name: true, phone: true, birthday: true },
    }),

    prisma.reminderLog.findMany({
      where: { sentAt: { gte: new Date(now.getTime() - 3 * 86_400_000) } },
      select: { kind: true, clientId: true, appointmentId: true, note: true },
    }),

    // Última sesión atendida de cada servicio con ciclo definido
    prisma.appointmentService.findMany({
      where: {
        appointment: { status: "ATTENDED" },
        service: { sessionIntervalDays: { not: null }, active: true },
      },
      orderBy: { appointment: { startAt: "desc" } },
      include: {
        service: { select: { id: true, name: true, sessionIntervalDays: true } },
        appointment: {
          select: {
            startAt: true,
            clientId: true,
            client: { select: { id: true, name: true, phone: true, active: true } },
          },
        },
      },
    }),
  ]);

  const sentKeys = new Set(
    recentLogs.map((log) => `${log.kind}:${log.clientId}:${log.appointmentId ?? log.note ?? ""}`),
  );

  const items: ReminderItem[] = [];

  for (const appointment of appointments) {
    const key = `APPOINTMENT:${appointment.clientId}:${appointment.id}`;
    items.push({
      key,
      kind: "APPOINTMENT",
      clientId: appointment.client.id,
      clientName: appointment.client.name,
      clientPhone: appointment.client.phone,
      title: "Recordar la cita",
      detail: appointment.services.map((s) => s.service.name).join(" + "),
      appointmentId: appointment.id,
      when: appointment.startAt,
      urgent: appointment.status === "PENDING",
      alreadySent: Boolean(appointment.reminderSentAt) || sentKeys.has(key),
    });
  }

  for (const sale of debts) {
    const balance = sale.totalCents - sale.paidCents;
    if (balance <= 0) continue;
    const key = `DEBT:${sale.clientId}:${sale.id}`;
    items.push({
      key,
      kind: "DEBT",
      clientId: sale.client.id,
      clientName: sale.client.name,
      clientPhone: sale.client.phone,
      title: "Cobrar saldo vencido",
      detail: `Venta #${sale.number}`,
      amountCents: balance,
      when: sale.dueDate ?? undefined,
      urgent: true,
      alreadySent: sentKeys.has(key),
    });
  }

  // Próxima sesión de depilación: solo la más reciente por clienta y servicio.
  const seen = new Set<string>();
  for (const entry of depilationHistory) {
    const client = entry.appointment.client;
    if (!client.active) continue;
    const pairKey = `${client.id}:${entry.service.id}`;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    const interval = entry.service.sessionIntervalDays!;
    const dueAt = new Date(entry.appointment.startAt.getTime() + interval * 86_400_000);
    if (dueAt > now) continue;

    // Si ya tiene otra cita agendada de ese servicio, no hace falta recordar.
    const hasUpcoming = appointments.some(
      (appointment) =>
        appointment.clientId === client.id &&
        appointment.services.some((s) => s.service.name === entry.service.name),
    );
    if (hasUpcoming) continue;

    const key = `NEXT_SESSION:${client.id}:${entry.service.id}`;
    const daysLate = Math.floor((now.getTime() - dueAt.getTime()) / 86_400_000);
    items.push({
      key,
      kind: "NEXT_SESSION",
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      title: "Le toca repetir",
      detail: entry.service.name,
      serviceName: entry.service.name,
      when: dueAt,
      urgent: daysLate > 14,
      alreadySent: sentKeys.has(key),
    });
  }

  for (const client of birthdays) {
    if (!client.birthday) continue;
    const birthdayKey = `${String(client.birthday.getUTCMonth() + 1).padStart(2, "0")}-${String(
      client.birthday.getUTCDate(),
    ).padStart(2, "0")}`;
    if (birthdayKey !== todayKey.slice(5)) continue;

    const key = `BIRTHDAY:${client.id}:`;
    items.push({
      key,
      kind: "BIRTHDAY",
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      title: "Cumple años hoy",
      detail: "Felicítala y ofrécele un detalle",
      urgent: false,
      alreadySent: sentKeys.has(key),
    });
  }

  const pending = items.filter((item) => !item.alreadySent);

  return {
    items,
    pending,
    counts: {
      total: pending.length,
      appointments: pending.filter((i) => i.kind === "APPOINTMENT").length,
      sessions: pending.filter((i) => i.kind === "NEXT_SESSION").length,
      debts: pending.filter((i) => i.kind === "DEBT").length,
      birthdays: pending.filter((i) => i.kind === "BIRTHDAY").length,
    },
  };
}

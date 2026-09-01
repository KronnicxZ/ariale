import "server-only";
import { prisma } from "@/lib/db";
import { TZ, addDays, dayKey, endOfDayUtc, startOfDayUtc } from "@/lib/date";
import type { AppointmentStatus } from "@/generated/prisma/client";

const APPOINTMENT_INCLUDE = {
  client: { select: { id: true, name: true, phone: true } },
  specialist: { select: { id: true, name: true, color: true, slug: true } },
  services: {
    include: { service: { select: { id: true, name: true, bodyZone: true } } },
  },
  sale: { select: { id: true, number: true, totalCents: true, paidCents: true, status: true } },
} as const;

export type AgendaAppointment = Awaited<ReturnType<typeof getDayAgenda>>["appointments"][number];

export async function getDayAgenda(options: {
  day: string;
  specialistId?: string;
  status?: AppointmentStatus;
  tz?: string;
}) {
  const tz = options.tz ?? TZ;
  const from = startOfDayUtc(options.day, tz);
  const to = endOfDayUtc(options.day, tz);

  const [appointments, specialists] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startAt: { gte: from, lte: to },
        ...(options.specialistId ? { specialistId: options.specialistId } : {}),
        ...(options.status ? { status: options.status } : {}),
      },
      orderBy: { startAt: "asc" },
      include: APPOINTMENT_INCLUDE,
    }),
    prisma.specialist.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, slug: true },
    }),
  ]);

  const counts = {
    total: appointments.length,
    pending: appointments.filter((a) => a.status === "PENDING").length,
    confirmed: appointments.filter((a) => a.status === "CONFIRMED").length,
    attended: appointments.filter((a) => a.status === "ATTENDED").length,
    cancelled: appointments.filter((a) => a.status === "CANCELLED" || a.status === "NO_SHOW").length,
  };

  const revenueCents = appointments
    .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
    .reduce((sum, a) => sum + a.services.reduce((s, x) => s + x.priceCents, 0), 0);

  return { appointments, specialists, counts, revenueCents };
}

/** Cuántas citas tiene cada uno de los próximos días, para la tira superior. */
export async function getWeekStrip(anchorDay: string, tz = TZ, days = 7) {
  const [y, m, d] = anchorDay.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));

  const from = startOfDayUtc(anchorDay, tz);
  const to = endOfDayUtc(dayKey(addDays(start, days - 1), tz), tz);

  const appointments = await prisma.appointment.findMany({
    where: { startAt: { gte: from, lte: to }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
    select: { startAt: true },
  });

  const counts = new Map<string, number>();
  for (const appointment of appointments) {
    const key = dayKey(appointment.startAt, tz);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, d + i));
    const key = date.toISOString().slice(0, 10);
    return {
      day: key,
      dayOfWeek: date.getUTCDay(),
      dayNumber: date.getUTCDate(),
      month: date.toLocaleDateString("es-VE", { month: "short", timeZone: "UTC" }),
      count: counts.get(key) ?? 0,
    };
  });
}

export async function getAppointment(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: {
      ...APPOINTMENT_INCLUDE,
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          notes: true,
          allergies: true,
        },
      },
    },
  });
}

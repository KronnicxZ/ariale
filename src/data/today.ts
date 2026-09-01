import "server-only";
import { prisma } from "@/lib/db";
import { TZ, addDays, dayKey, endOfDayUtc, resolvePeriod, startOfDayUtc } from "@/lib/date";

/**
 * Lo que la dueña necesita ver al abrir la app: cómo viene el día.
 *
 * Es a propósito mucho más ligero que el panel de reportes: aquí manda la
 * agenda, y el dinero aparece resumido en tres cifras que llevan a Reportes.
 */
export async function getToday(tz = TZ) {
  const now = new Date();
  const today = dayKey(now, tz);
  const from = startOfDayUtc(today, tz);
  const to = endOfDayUtc(today, tz);
  const month = resolvePeriod("month", tz);

  const [appointments, pendingCount, overdueCount, monthSales, monthPayments, open] =
    await Promise.all([
      prisma.appointment.findMany({
        where: { startAt: { gte: from, lte: to }, status: { not: "CANCELLED" } },
        orderBy: { startAt: "asc" },
        include: {
          client: { select: { id: true, name: true, phone: true } },
          specialist: { select: { id: true, name: true, color: true } },
          services: { include: { service: { select: { name: true } } } },
          sale: { select: { id: true, status: true } },
        },
      }),
      prisma.appointment.count({ where: { status: "PENDING", startAt: { gte: now } } }),
      prisma.sale.count({
        where: { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: now } },
      }),
      prisma.sale.aggregate({
        where: { date: { gte: month.from, lte: month.to }, status: { not: "CANCELLED" } },
        _sum: { totalCents: true },
      }),
      prisma.payment.aggregate({
        where: { date: { gte: month.from, lte: month.to } },
        _sum: { amountCents: true },
      }),
      prisma.sale.findMany({
        where: { status: { in: ["PENDING", "PARTIAL"] } },
        select: { totalCents: true, paidCents: true },
      }),
    ]);

  const attended = appointments.filter((a) => a.status === "ATTENDED").length;
  const pendingToday = appointments.filter((a) => a.status === "PENDING").length;
  const expectedCents = appointments
    .filter((a) => a.status !== "NO_SHOW")
    .reduce((sum, a) => sum + a.services.reduce((s, x) => s + x.priceCents, 0), 0);

  // La próxima cita que todavía no ha empezado.
  const next = appointments.find((a) => a.startAt >= now && a.status !== "ATTENDED") ?? null;

  return {
    today,
    appointments,
    next,
    counts: {
      total: appointments.length,
      attended,
      pendingToday,
      pendingConfirm: pendingCount,
      overdue: overdueCount,
    },
    money: {
      expectedCents,
      monthSalesCents: monthSales._sum.totalCents ?? 0,
      monthCollectedCents: monthPayments._sum.amountCents ?? 0,
      receivableCents: open.reduce((sum, s) => sum + s.totalCents - s.paidCents, 0),
    },
  };
}

/** Cuántas citas hay en cada uno de los próximos días, para la tira superior. */
export async function getUpcomingStrip(tz = TZ, days = 7) {
  const today = dayKey(new Date(), tz);
  const from = startOfDayUtc(today, tz);
  const [y, m, d] = today.split("-").map(Number);
  const to = endOfDayUtc(dayKey(addDays(new Date(Date.UTC(y, m - 1, d)), days - 1), tz), tz);

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

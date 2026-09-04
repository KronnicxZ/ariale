import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentSpecialist } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PinGate } from "./pin-gate";
import { SpecialistAgenda } from "./specialist-agenda";
import { getBookingOptions, getClientOptions } from "@/data/booking";
import { getRate } from "@/lib/rate";
import { dayKey, endOfDayUtc, startOfDayUtc } from "@/lib/date";
import { stringParam } from "@/lib/period";

export async function generateMetadata(props: PageProps<"/agenda/[slug]">) {
  const { slug } = await props.params;
  const specialist = await prisma.specialist.findUnique({ where: { slug } });
  return { title: specialist ? `Agenda de ${specialist.name}` : "Agenda" };
}

export default async function SpecialistAgendaPage(props: PageProps<"/agenda/[slug]">) {
  const { slug } = await props.params;
  const params = await props.searchParams;

  const [specialist, settings] = await Promise.all([
    prisma.specialist.findUnique({ where: { slug } }),
    getSettings(),
  ]);
  if (!specialist || !specialist.active) notFound();

  const session = await getCurrentSpecialist();

  // La clave abre solo esta agenda: si la sesión es de otra persona, se pide de nuevo.
  if (!session || session.id !== specialist.id) {
    return (
      <PinGate
        slug={slug}
        name={specialist.name}
        business={settings.businessName}
        logoUrl={settings.logoUrl}
      />
    );
  }

  const today = dayKey(new Date(), settings.timezone);
  const day = stringParam(params, "dia") ?? today;

  const [appointments, booking, clients, rate] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        specialistId: specialist.id,
        startAt: {
          gte: startOfDayUtc(day, settings.timezone),
          lte: endOfDayUtc(day, settings.timezone),
        },
      },
      orderBy: { startAt: "asc" },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
    getBookingOptions(),
    getClientOptions(),
    getRate(),
  ]);

  // Solo mostramos lo que esta especialista sabe hacer.
  const mySkills = booking.specialists.find((s) => s.id === specialist.id)?.serviceIds ?? [];
  const myServices = booking.services.filter((s) => mySkills.includes(s.id));

  return (
    <SpecialistAgenda
      specialist={{ id: specialist.id, name: specialist.name, slug, color: specialist.color }}
      business={{
        name: settings.businessName,
        countryCode: settings.countryCode,
        timezone: settings.timezone,
      }}
      day={day}
      today={today}
      maxDay={booking.maxDay}
      closedWeekdays={booking.closedWeekdays}
      appointments={appointments.map((a) => ({
        id: a.id,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt.toISOString(),
        status: a.status,
        note: a.note,
        source: a.source,
        client: a.client,
        services: a.services.map((s) => ({
          name: s.service.name,
          priceCents: s.priceCents,
          durationMin: s.durationMin,
        })),
      }))}
      services={myServices.length > 0 ? myServices : booking.services}
      clients={clients}
      rate={rate.rate}
    />
  );
}

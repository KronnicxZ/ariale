import { PageHeader } from "@/components/panel/page-header";
import { prisma } from "@/lib/db";
import { getBookingOptions, getClientOptions, getClientPackages } from "@/data/booking";
import { getRate } from "@/lib/rate";
import { dayKey } from "@/lib/date";
import { stringParam } from "@/lib/period";
import { SaleForm } from "./sale-form";

export const metadata = { title: "Nueva venta" };

export default async function NewSalePage(props: PageProps<"/panel/ventas/nueva">) {
  const params = await props.searchParams;
  const appointmentId = stringParam(params, "cita");
  const clientId = stringParam(params, "clienta");

  const [{ settings, services, specialists }, clients, packages, rate] = await Promise.all([
    getBookingOptions(),
    getClientOptions(),
    prisma.package.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, priceCents: true, sessions: true },
    }),
    getRate(),
  ]);

  // Al cobrar una cita, la venta llega con todo precargado.
  const appointment = appointmentId
    ? await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          client: { select: { id: true, name: true } },
          services: { include: { service: { select: { id: true, name: true } } } },
        },
      })
    : null;

  const fallbackClient =
    !appointment && clientId
      ? await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } })
      : null;

  const targetClientId = appointment?.client.id ?? fallbackClient?.id;
  const clientPackages = targetClientId ? await getClientPackages(targetClientId) : [];

  const prefill = appointment
    ? {
        client: { kind: "existing" as const, id: appointment.client.id, name: appointment.client.name },
        specialistId: appointment.specialistId,
        appointmentId: appointment.id,
        lines: appointment.services.map((entry) => ({
          serviceId: entry.service.id,
          description: entry.service.name,
          unitPriceCents: entry.priceCents,
        })),
      }
    : fallbackClient
      ? {
          client: { kind: "existing" as const, id: fallbackClient.id, name: fallbackClient.name },
          specialistId: null,
          appointmentId: "",
          lines: [],
        }
      : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Nueva venta"
        description={
          appointment
            ? `Cobro de la cita de ${appointment.client.name}`
            : "Servicios, descuento y forma de pago."
        }
      />
      <SaleForm
        clients={clients}
        services={services}
        specialists={specialists.map((s) => ({ id: s.id, name: s.name }))}
        packages={packages}
        rate={rate.rate}
        countryCode={settings.countryCode}
        today={dayKey(new Date(), settings.timezone)}
        prefill={prefill?.appointmentId ? prefill : prefill ? { ...prefill, appointmentId: "" } : undefined}
        prefillPackages={clientPackages}
      />
    </div>
  );
}

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { getCurrentClient } from "@/lib/auth";
import { getBookingOptions, getClientPackages } from "@/data/booking";
import { getRate } from "@/lib/rate";
import { firstName } from "@/lib/utils";
import { ClientBooking } from "./client-booking";

/**
 * Agendar, sin puerta delante.
 *
 * Antes esta página abría pidiendo el teléfono: quien solo quería ver si
 * quedaba hueco el sábado tenía que entregarlo primero. Ahora se elige
 * servicio, día y hora, y el número se pide una sola vez al confirmar, que
 * es cuando ya hay algo que reservar.
 *
 * Quien ya tiene sesión no lo escribe: se reconoce y se saluda por su
 * nombre.
 */
export const metadata = {
  title: "Agenda tu cita",
  description:
    "Elige el servicio, el día y la hora. Ves los precios y los huecos libres antes de reservar, sin esperar a que te contesten.",
  alternates: { canonical: "/reservar" },
};

export default async function ReservarPage(props: PageProps<"/reservar">) {
  const params = await props.searchParams;
  const client = await getCurrentClient();

  const [{ settings, services, specialists, today, maxDay, closedWeekdays }, packages, rate] =
    await Promise.all([
      getBookingOptions(),
      client ? getClientPackages(client.id) : Promise.resolve([]),
      getRate(),
    ]);

  // "Agendar" desde la lista de precios de la portada llega con el servicio
  // puesto. Se comprueba contra el catálogo: un id inventado en la barra de
  // direcciones no tiene que dejar el asistente en un estado imposible.
  const pedido = params.servicio;
  const preseleccion = (Array.isArray(pedido) ? pedido : pedido ? [pedido] : []).filter((id) =>
    services.some((s) => s.id === id),
  );

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-primary text-xs font-semibold tracking-widest uppercase">
            {client ? `Hola, ${firstName(client.name)}` : "Tu cita"}
          </p>
          <h1 className="font-display text-2xl font-semibold">Reserva en un minuto</h1>
        </div>

        <Link
          href="/reservar/mis-citas"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition"
        >
          <CalendarClock className="size-4" />
          Mis citas
        </Link>
      </header>

      <ClientBooking
        services={services}
        specialists={specialists}
        packages={packages}
        today={today}
        maxDay={maxDay}
        closedWeekdays={closedWeekdays}
        rate={rate.rate}
        autoConfirm={settings.autoConfirm}
        business={settings.businessName}
        countryCode={settings.countryCode}
        yaIdentificada={Boolean(client)}
        preseleccion={preseleccion}
      />
    </div>
  );
}

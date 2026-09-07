import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentClient } from "@/lib/auth";
import { getBookingOptions } from "@/data/booking";
import { dayKey, fmtDayLong, fmtTime } from "@/lib/date";
import { CambiarHora } from "./cambiar-hora";

/**
 * Mover una cita de día o de hora.
 *
 * Los servicios y la especialista no se tocan: es la misma cita, en otro
 * momento. Antes había que cancelar y volver a empezar, y para cuando
 * volvías el hueco podía haberlo cogido otra.
 */
export const metadata = { title: "Cambiar hora", robots: { index: false, follow: false } };

export default async function CambiarCitaPage(
  props: PageProps<"/reservar/mis-citas/[id]/cambiar">,
) {
  const { id } = await props.params;
  const client = await getCurrentClient();
  if (!client) redirect("/reservar/mis-citas");

  const [cita, { settings, today, maxDay, closedWeekdays }] = await Promise.all([
    prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        startAt: true,
        status: true,
        specialistId: true,
        specialist: { select: { name: true } },
        services: { select: { service: { select: { id: true, name: true } } } },
      },
    }),
    getBookingOptions(),
  ]);

  if (!cita || cita.clientId !== client.id) notFound();

  // Una cita pasada, cancelada o ya atendida no se mueve: se agenda otra.
  if (
    cita.startAt < new Date() ||
    cita.status === "CANCELLED" ||
    cita.status === "ATTENDED" ||
    cita.status === "NO_SHOW"
  ) {
    redirect("/reservar/mis-citas");
  }

  return (
    <div className="mx-auto w-full max-w-md flex-1 px-5 py-5">
      <Link
        href="/reservar/mis-citas"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition"
      >
        <ArrowLeft className="size-4" />
        Mis citas
      </Link>

      <h1 className="font-display text-2xl font-semibold">Cambiar la hora</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        {cita.services.map((s) => s.service.name).join(" + ")} · con {cita.specialist.name}
      </p>

      <p className="bg-muted/60 mt-4 rounded-2xl px-4 py-3 text-sm">
        <span className="text-muted-foreground">Ahora la tienes </span>
        <span className="font-medium capitalize">
          {fmtDayLong(cita.startAt, settings.timezone)} · {fmtTime(cita.startAt, settings.timezone)}
        </span>
      </p>

      <div className="mt-6">
        <CambiarHora
          id={cita.id}
          serviceIds={cita.services.map((s) => s.service.id)}
          specialistId={cita.specialistId}
          diaActual={dayKey(cita.startAt, settings.timezone)}
          today={today}
          maxDay={maxDay}
          closedWeekdays={closedWeekdays}
        />
      </div>
    </div>
  );
}

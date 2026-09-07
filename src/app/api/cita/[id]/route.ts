import { prisma } from "@/lib/db";
import { getCurrentClient } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

/**
 * La cita en un archivo que el teléfono entiende (.ics).
 *
 * Al confirmar, la clienta puede meterla en su calendario de un toque. Es la
 * forma más barata de que no se le olvide: el recordatorio lo pone su propio
 * teléfono, no hace falta que se lo mandemos nosotras.
 *
 * Solo la dueña de la cita puede bajársela: se comprueba contra la sesión,
 * no basta con acertar el identificador.
 */

/** En un .ics las comas, los puntos y coma y las barras van escapados. */
function escapar(texto: string) {
  return texto.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

/** Los instantes van en UTC: "20260910T190000Z". */
function marca(fecha: Date) {
  return `${fecha.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await getCurrentClient();
  if (!client) return new Response("No autorizada", { status: 401 });

  const [cita, settings] = await Promise.all([
    prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        startAt: true,
        endAt: true,
        status: true,
        specialist: { select: { name: true } },
        services: { select: { service: { select: { name: true } } } },
      },
    }),
    getSettings(),
  ]);

  if (!cita || cita.clientId !== client.id) {
    return new Response("No encontrada", { status: 404 });
  }

  const servicios = cita.services.map((s) => s.service.name).join(" + ");
  const cancelada = cita.status === "CANCELLED";

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapar(settings.businessName)}//ES`,
    "CALSCALE:GREGORIAN",
    cancelada ? "METHOD:CANCEL" : "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${cita.id}@ariale.space`,
    `DTSTAMP:${marca(new Date())}`,
    `DTSTART:${marca(cita.startAt)}`,
    `DTEND:${marca(cita.endAt)}`,
    `SUMMARY:${escapar(`${servicios} · ${settings.businessName}`)}`,
    `DESCRIPTION:${escapar(`Con ${cita.specialist.name}.`)}`,
    ...(settings.address ? [`LOCATION:${escapar(settings.address)}`] : []),
    // Una cita pendiente de confirmar entra como tentativa, que es lo que
    // significa: el estudio todavía no ha dicho que sí.
    cancelada ? "STATUS:CANCELLED" : cita.status === "PENDING" ? "STATUS:TENTATIVE" : "STATUS:CONFIRMED",
    // Un aviso dos horas antes, que es cuando todavía da tiempo a salir.
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapar(`Tu cita en ${settings.businessName}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // Con CRLF: es lo que manda la norma y lo que algunos calendarios exigen.
  return new Response(lineas.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="cita-${cita.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

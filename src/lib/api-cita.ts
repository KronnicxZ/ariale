import "server-only";
import { prisma } from "@/lib/db";

/**
 * Qué servicios lleva una cita y quién la atiende.
 *
 * Al mover una cita desde la app no hace falta que el teléfono mande la
 * lista de servicios: ya está en la cita. Manda su identificador y aquí se
 * resuelve, que además evita que un cliente mal escrito pida huecos para
 * una combinación que no es la de esa cita.
 */
export async function serviciosDeLaCita(citaId: string) {
  const cita = await prisma.appointment.findUnique({
    where: { id: citaId },
    select: { specialistId: true, services: { select: { serviceId: true } } },
  });
  if (!cita) throw new Error("Esa cita ya no existe.");

  return {
    specialistId: cita.specialistId,
    serviceIds: cita.services.map((s) => s.serviceId),
  };
}

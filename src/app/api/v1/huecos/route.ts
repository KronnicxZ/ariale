import { param, withUser } from "@/lib/api";
import { fetchSlotsAction } from "@/actions/appointments";
import { serviciosDeLaCita } from "@/lib/api-cita";

/**
 * Huecos libres de un día para una combinación de servicios.
 * Reutiliza el mismo cálculo que la web, así que la app nunca ofrece
 * un horario que el servidor luego rechace.
 */
export const GET = withUser(async ({ request }) => {
  const day = param(request, "dia");
  if (!day) throw new Error("Falta el día.");

  // Al mover una cita basta con decir cuál: sus servicios salen de ella, y
  // además no se cuenta a sí misma como ocupada —si no, su propia hora sale
  // llena y no se podría pasar de las tres a las cinco del mismo día.
  const citaId = param(request, "cita");
  const deLaCita = citaId ? await serviciosDeLaCita(citaId) : null;

  const serviceIds =
    deLaCita?.serviceIds ?? (param(request, "servicios") ?? "").split(",").filter(Boolean);
  if (serviceIds.length === 0) throw new Error("Elige al menos un servicio.");

  const specialistId = deLaCita?.specialistId ?? param(request, "especialista") ?? null;

  const result = await fetchSlotsAction({
    day,
    serviceIds,
    specialistId,
    excludeAppointmentId: citaId ?? undefined,
  });

  return {
    dia: result.day,
    abierto: result.open,
    duracionMin: result.durationMin,
    motivo: result.reason ?? null,
    huecos: result.slots.map((s) => ({ hora: s.time, franja: s.period })),
  };
});

export { OPTIONS } from "@/lib/api";

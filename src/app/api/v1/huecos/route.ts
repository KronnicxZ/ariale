import { param, withUser } from "@/lib/api";
import { fetchSlotsAction } from "@/actions/appointments";

/**
 * Huecos libres de un día para una combinación de servicios.
 * Reutiliza el mismo cálculo que la web, así que la app nunca ofrece
 * un horario que el servidor luego rechace.
 */
export const GET = withUser(async ({ request }) => {
  const day = param(request, "dia");
  const services = param(request, "servicios");
  const specialistId = param(request, "especialista") ?? null;

  if (!day) throw new Error("Falta el día.");
  const serviceIds = (services ?? "").split(",").filter(Boolean);
  if (serviceIds.length === 0) throw new Error("Elige al menos un servicio.");

  const result = await fetchSlotsAction({ day, serviceIds, specialistId });

  return {
    dia: result.day,
    abierto: result.open,
    duracionMin: result.durationMin,
    motivo: result.reason ?? null,
    huecos: result.slots.map((s) => ({ hora: s.time, franja: s.period })),
  };
});

export { OPTIONS } from "@/lib/api";

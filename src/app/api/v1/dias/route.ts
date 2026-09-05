import { param, withUser } from "@/lib/api";
import { fetchDiasAction } from "@/actions/appointments";

/**
 * Qué días de un tramo tienen al menos un hueco para lo que se pidió.
 *
 * Es el mismo cálculo que usa la web para apagar los días llenos en el
 * calendario. La app lo necesita por lo mismo: sin esto, la tira de días
 * ofrece jornadas donde ya no cabe nada y hay que tocarlas una por una para
 * descubrirlo.
 */
export const GET = withUser(async ({ request }) => {
  const desde = param(request, "desde");
  const hasta = param(request, "hasta");
  const servicios = param(request, "servicios");
  const especialista = param(request, "especialista") ?? null;

  if (!desde || !hasta) throw new Error("Falta el tramo de días.");
  const serviceIds = (servicios ?? "").split(",").filter(Boolean);
  if (serviceIds.length === 0) throw new Error("Elige al menos un servicio.");

  const { dias } = await fetchDiasAction({
    desde,
    hasta,
    serviceIds,
    specialistId: especialista,
  });

  return { dias };
});

export { OPTIONS } from "@/lib/api";

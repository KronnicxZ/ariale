import { withUser } from "@/lib/api";
import { getToday, getUpcomingStrip } from "@/data/today";
import { getSettings } from "@/lib/settings";
import { serializeAppointment } from "@/lib/api-serializers";

/** La pantalla de inicio de la app: el día de hoy y la tira de la semana. */
export const GET = withUser(async () => {
  const settings = await getSettings();
  const [data, strip] = await Promise.all([
    getToday(settings.timezone),
    getUpcomingStrip(settings.timezone),
  ]);

  return {
    hoy: data.today,
    proximaCitaId: data.next?.id ?? null,
    citas: data.appointments.map(serializeAppointment),
    contadores: {
      total: data.counts.total,
      atendidas: data.counts.attended,
      porConfirmarHoy: data.counts.pendingToday,
      porConfirmar: data.counts.pendingConfirm,
      vencidas: data.counts.overdue,
    },
    dinero: {
      previstoCentavos: data.money.expectedCents,
      ventasMesCentavos: data.money.monthSalesCents,
      cobradoMesCentavos: data.money.monthCollectedCents,
      porCobrarCentavos: data.money.receivableCents,
    },
    semana: strip.map((d) => ({
      dia: d.day,
      diaSemana: d.dayOfWeek,
      numero: d.dayNumber,
      mes: d.month,
      citas: d.count,
    })),
  };
});

export { OPTIONS } from "@/lib/api";

import { param, withUser } from "@/lib/api";
import { getReceivables } from "@/data/sales";

/** Cuentas por cobrar, vencidas primero. */
export const GET = withUser(async ({ request }) => {
  const soloVencidas = param(request, "estado") === "vencidas";
  const { rows, totals } = await getReceivables({ overdue: soloVencidas });

  return {
    totales: {
      cuentas: totals.count,
      totalCentavos: totals.totalCents,
      cobradoCentavos: totals.paidCents,
      saldoCentavos: totals.balanceCents,
      vencidasCentavos: totals.overdueCents,
      vencidas: totals.overdueCount,
    },
    cuentas: rows.map((r) => ({
      id: r.id,
      numero: r.number,
      fecha: r.date.toISOString(),
      vence: r.dueDate?.toISOString() ?? null,
      concepto: r.description,
      totalCentavos: r.totalCents,
      cobradoCentavos: r.paidCents,
      saldoCentavos: r.balanceCents,
      estado: r.status,
      vencida: r.overdue,
      diasVencida: r.daysOverdue,
      clienta: {
        id: r.client.id,
        nombre: r.client.name,
        telefono: r.client.phone,
      },
    })),
  };
});

export { OPTIONS } from "@/lib/api";

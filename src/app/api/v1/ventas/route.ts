import { param, periodParam, withUser } from "@/lib/api";
import { getSales } from "@/data/sales";
import { serializeSale } from "@/lib/api-serializers";
import { createSaleRecord } from "@/lib/sales-core";
import type { PaymentMethod, SaleStatus } from "@/generated/prisma/client";

const ESTADOS = new Set(["PENDING", "PARTIAL", "PAID", "CANCELLED"]);

/** Listado de ventas del periodo, con sus totales. */
export const GET = withUser(async ({ request }) => {
  const { period, preset } = periodParam(request, "month");
  const estado = param(request, "estado");

  const { sales, totals } = await getSales({
    period,
    status: estado && ESTADOS.has(estado) ? (estado as SaleStatus) : undefined,
    clientQuery: param(request, "q"),
    specialistId: param(request, "especialista"),
  });

  return {
    periodo: { atajo: preset, etiqueta: period.label },
    totales: {
      cuenta: totals.count,
      totalCentavos: totals.totalCents,
      cobradoCentavos: totals.paidCents,
      pendienteCentavos: totals.pendingCents,
    },
    ventas: sales.map(serializeSale),
  };
});

type Linea = {
  servicioId?: string | null;
  descripcion?: string;
  cantidad?: number;
  precioCentavos?: number;
  bonoClientaId?: string | null;
};

type Body = {
  clientaId?: string;
  especialistaId?: string | null;
  citaId?: string | null;
  lineas?: Linea[];
  descuentoCentavos?: number;
  fecha?: string | null;
  vence?: string | null;
  notas?: string | null;
  bonoId?: string | null;
  pago?: { montoCentavos?: number; metodo?: string; referencia?: string | null } | null;
};

/** Registra una venta. Misma regla que la web: bonos, cobro inicial y cita. */
export const POST = withUser(async ({ request }) => {
  const body = (await request.json()) as Body;

  const venta = await createSaleRecord({
    clientId: body.clientaId ?? "",
    specialistId: body.especialistaId ?? null,
    appointmentId: body.citaId ?? null,
    items: (body.lineas ?? []).map((linea) => ({
      serviceId: linea.servicioId ?? null,
      description: linea.descripcion ?? "",
      quantity: Math.max(1, Math.round(linea.cantidad ?? 1)),
      unitPriceCents: Math.round(linea.precioCentavos ?? 0),
      clientPackageId: linea.bonoClientaId ?? null,
    })),
    discountCents: Math.max(0, Math.round(body.descuentoCentavos ?? 0)),
    date: body.fecha ?? null,
    dueDate: body.vence ?? null,
    notes: body.notas ?? null,
    packageId: body.bonoId ?? null,
    payment:
      body.pago && (body.pago.montoCentavos ?? 0) > 0
        ? {
            amountCents: Math.round(body.pago.montoCentavos ?? 0),
            method: (body.pago.metodo ?? "CASH_USD") as PaymentMethod,
            reference: body.pago.referencia ?? null,
          }
        : null,
  });

  return { id: venta.id, numero: venta.number };
});

export { OPTIONS } from "@/lib/api";

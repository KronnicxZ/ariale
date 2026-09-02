import { withUserParams } from "@/lib/api";
import { getSale } from "@/data/sales";
import { prisma } from "@/lib/db";

/** Detalle de una venta: líneas, cobros y bonos vendidos. */
export const GET = withUserParams<{ id: string }, unknown>(async ({ params }) => {
  const venta = await getSale(params.id);
  if (!venta) throw new Error("Esa venta ya no existe.");

  return {
    id: venta.id,
    numero: venta.number,
    fecha: venta.date.toISOString(),
    estado: venta.status,
    vence: venta.dueDate?.toISOString() ?? null,
    notas: venta.notes,
    subtotalCentavos: venta.subtotalCents,
    descuentoCentavos: venta.discountCents,
    totalCentavos: venta.totalCents,
    cobradoCentavos: venta.paidCents,
    saldoCentavos: venta.totalCents - venta.paidCents,
    tasaUsada: venta.rateUsed,
    clienta: {
      id: venta.client.id,
      nombre: venta.client.name,
      telefono: venta.client.phone,
    },
    especialista: venta.specialist
      ? { id: venta.specialist.id, nombre: venta.specialist.name }
      : null,
    citaId: venta.appointment?.id ?? null,
    lineas: venta.items.map((linea) => ({
      id: linea.id,
      descripcion: linea.description,
      cantidad: linea.quantity,
      precioCentavos: linea.unitPriceCents,
      totalCentavos: linea.totalCents,
      bono: linea.clientPackage?.package.name ?? null,
    })),
    pagos: venta.payments.map((pago) => ({
      id: pago.id,
      fecha: pago.date.toISOString(),
      montoCentavos: pago.amountCents,
      metodo: pago.method,
      referencia: pago.reference,
      tasaUsada: pago.rateUsed,
    })),
    bonosVendidos: venta.packagesSold.map((bono) => ({
      id: bono.id,
      nombre: bono.package.name,
      sesiones: bono.sessionsTotal,
      usadas: bono.sessionsUsed,
      vence: bono.expiresAt.toISOString(),
    })),
  };
});

/**
 * Anula la venta. No la borra: el historial de caja tiene que poder
 * explicarse después, y una venta anulada queda a la vista.
 */
export const DELETE = withUserParams<{ id: string }, unknown>(async ({ params }) => {
  await prisma.sale.update({ where: { id: params.id }, data: { status: "CANCELLED" } });
  return { anulada: true };
});

export { OPTIONS } from "@/lib/api";

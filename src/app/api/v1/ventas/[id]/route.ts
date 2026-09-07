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
/**
 * Anula la venta, o la borra del todo con `definitiva=1`.
 *
 * Anular es lo normal: deja de contar en los totales pero el historial de
 * caja se conserva, que es lo que quiere cualquiera que se equivoque
 * cobrando. Borrar es para lo que nunca debió existir —las pruebas— y por
 * eso hay que pedirlo aparte. Los cobros y las líneas se van con ella; la
 * cita, si la tuviera, se queda.
 */
export const DELETE = withUserParams<{ id: string }, unknown>(async ({ request, params }) => {
  const definitiva = new URL(request.url).searchParams.get("definitiva") === "1";

  const venta = await prisma.sale.findUnique({
    where: { id: params.id },
    select: { number: true, _count: { select: { payments: true } } },
  });
  if (!venta) throw new Error("Esa venta ya no existe.");

  if (definitiva) {
    await prisma.sale.delete({ where: { id: params.id } });
    return { borrada: true, numero: venta.number };
  }

  await prisma.sale.update({ where: { id: params.id }, data: { status: "CANCELLED" } });
  return { anulada: true, numero: venta.number, cobros: venta._count.payments };
});

export { OPTIONS } from "@/lib/api";

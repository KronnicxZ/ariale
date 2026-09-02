import { withUserParams } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getRate } from "@/lib/rate";
import { VES_METHODS } from "@/lib/money";
import type { PaymentMethod, SaleStatus } from "@/generated/prisma/client";

function estadoPara(totalCents: number, paidCents: number): SaleStatus {
  if (paidCents <= 0) return "PENDING";
  if (paidCents >= totalCents) return "PAID";
  return "PARTIAL";
}

/**
 * Registra un abono. Nunca cobra de más: si el monto supera el saldo,
 * se aplica solo lo que faltaba.
 */
export const POST = withUserParams<{ id: string }, unknown>(async ({ request, params }) => {
  const body = (await request.json()) as {
    montoCentavos?: number;
    metodo?: string;
    referencia?: string;
  };

  const monto = Math.round(body.montoCentavos ?? 0);
  if (monto <= 0) throw new Error("El monto debe ser mayor que cero.");

  const venta = await prisma.sale.findUnique({
    where: { id: params.id },
    select: { totalCents: true, paidCents: true },
  });
  if (!venta) throw new Error("Esa venta ya no existe.");

  const saldo = venta.totalCents - venta.paidCents;
  if (saldo <= 0) throw new Error("Esa venta ya está cobrada por completo.");

  const aplicado = Math.min(monto, saldo);
  const metodo = (body.metodo ?? "CASH_USD") as PaymentMethod;
  const rate = await getRate();
  const cobrado = venta.paidCents + aplicado;

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        saleId: params.id,
        amountCents: aplicado,
        method: metodo,
        reference: body.referencia?.trim() || null,
        rateUsed: VES_METHODS.has(metodo) ? rate.rate || null : null,
      },
    }),
    prisma.sale.update({
      where: { id: params.id },
      data: { paidCents: cobrado, status: estadoPara(venta.totalCents, cobrado) },
    }),
  ]);

  return {
    aplicadoCentavos: aplicado,
    cobradoCentavos: cobrado,
    saldoCentavos: venta.totalCents - cobrado,
    parcial: aplicado < monto,
  };
});

export { OPTIONS } from "@/lib/api";

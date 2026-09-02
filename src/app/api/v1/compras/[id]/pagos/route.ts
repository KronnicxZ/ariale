import { withUserParams } from "@/lib/api";
import { prisma } from "@/lib/db";
import { purchaseStatusFor } from "@/lib/sales-core";
import type { PaymentMethod } from "@/generated/prisma/client";

/** Abona a una compra. Nunca paga de más: aplica solo lo que faltaba. */
export const POST = withUserParams<{ id: string }, unknown>(async ({ request, params }) => {
  const body = (await request.json()) as {
    montoCentavos?: number;
    metodo?: string;
    referencia?: string;
  };

  const monto = Math.round(body.montoCentavos ?? 0);
  if (monto <= 0) throw new Error("El monto debe ser mayor que cero.");

  const compra = await prisma.purchase.findUnique({
    where: { id: params.id },
    select: { totalCents: true, paidCents: true },
  });
  if (!compra) throw new Error("Esa compra ya no existe.");

  const saldo = compra.totalCents - compra.paidCents;
  if (saldo <= 0) throw new Error("Esa compra ya está pagada.");

  const aplicado = Math.min(monto, saldo);
  const pagado = compra.paidCents + aplicado;

  await prisma.$transaction([
    prisma.purchasePayment.create({
      data: {
        purchaseId: params.id,
        amountCents: aplicado,
        method: (body.metodo ?? "CASH_USD") as PaymentMethod,
        reference: body.referencia?.trim() || null,
      },
    }),
    prisma.purchase.update({
      where: { id: params.id },
      data: { paidCents: pagado, status: purchaseStatusFor(compra.totalCents, pagado) },
    }),
  ]);

  return {
    aplicadoCentavos: aplicado,
    pagadoCentavos: pagado,
    saldoCentavos: compra.totalCents - pagado,
    parcial: aplicado < monto,
  };
});

export { OPTIONS } from "@/lib/api";

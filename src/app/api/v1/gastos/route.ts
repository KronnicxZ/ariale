import { param, periodParam, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { parseDay } from "@/lib/sales-core";
import type { PaymentMethod } from "@/generated/prisma/client";

/** Gastos del periodo con su total y las categorías disponibles. */
export const GET = withUser(async ({ request }) => {
  const { period, preset } = periodParam(request, "month");
  const categoriaId = param(request, "categoria");

  const [gastos, categorias] = await Promise.all([
    prisma.expense.findMany({
      where: {
        date: { gte: period.from, lte: period.to },
        ...(categoriaId ? { categoryId: categoriaId } : {}),
      },
      orderBy: { date: "desc" },
      include: { category: { select: { id: true, name: true, color: true } } },
    }),
    prisma.expenseCategory.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  // Cuánto pesa cada categoría: es lo primero que se mira al recortar.
  const porCategoria = new Map<string, { nombre: string; color: string; totalCentavos: number }>();
  for (const gasto of gastos) {
    const clave = gasto.categoryId ?? "sin";
    const actual = porCategoria.get(clave) ?? {
      nombre: gasto.category?.name ?? "Sin categoría",
      color: gasto.category?.color ?? "#999999",
      totalCentavos: 0,
    };
    actual.totalCentavos += gasto.amountCents;
    porCategoria.set(clave, actual);
  }

  return {
    periodo: { atajo: preset, etiqueta: period.label },
    totales: {
      cuenta: gastos.length,
      totalCentavos: gastos.reduce((suma, g) => suma + g.amountCents, 0),
    },
    porCategoria: [...porCategoria.values()].sort(
      (a, b) => b.totalCentavos - a.totalCentavos,
    ),
    categorias: categorias.map((c) => ({ id: c.id, nombre: c.name, color: c.color })),
    gastos: gastos.map((g) => ({
      id: g.id,
      fecha: g.date.toISOString(),
      descripcion: g.description,
      montoCentavos: g.amountCents,
      metodo: g.method,
      categoria: g.category
        ? { id: g.category.id, nombre: g.category.name, color: g.category.color }
        : null,
    })),
  };
});

export const POST = withUser(async ({ request, user }) => {
  const body = (await request.json()) as {
    id?: string;
    descripcion?: string;
    montoCentavos?: number;
    categoriaId?: string | null;
    metodo?: string;
    fecha?: string | null;
  };

  const descripcion = body.descripcion?.trim() ?? "";
  const monto = Math.round(body.montoCentavos ?? 0);
  if (!descripcion) throw new Error("Describe el gasto.");
  if (monto <= 0) throw new Error("El monto debe ser mayor que cero.");

  const datos = {
    description: descripcion,
    amountCents: monto,
    categoryId: body.categoriaId || null,
    method: (body.metodo ?? "CASH_USD") as PaymentMethod,
    date: parseDay(body.fecha) ?? new Date(),
    userId: user.id,
  };

  const gasto = body.id
    ? await prisma.expense.update({ where: { id: body.id }, data: datos })
    : await prisma.expense.create({ data: datos });

  return { id: gasto.id };
});

export { OPTIONS } from "@/lib/api";

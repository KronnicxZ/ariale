import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";

/** Proveedores con lo que se les debe hoy. */
export const GET = withUser(async () => {
  const proveedores = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      purchases: {
        where: { status: { in: ["PENDING", "PARTIAL"] } },
        select: { totalCents: true, paidCents: true },
      },
    },
  });

  return {
    proveedores: proveedores.map((p) => ({
      id: p.id,
      nombre: p.name,
      telefono: p.phone,
      correo: p.email,
      notas: p.notes,
      activo: p.active,
      comprasAbiertas: p.purchases.length,
      saldoCentavos: p.purchases.reduce((suma, c) => suma + c.totalCents - c.paidCents, 0),
    })),
  };
});

export const POST = withUser(async ({ request }) => {
  const body = (await request.json()) as {
    id?: string;
    nombre?: string;
    telefono?: string;
    correo?: string;
    notas?: string;
  };

  const nombre = body.nombre?.trim() ?? "";
  if (nombre.length < 2) throw new Error("Escribe el nombre del proveedor.");

  const datos = {
    name: nombre,
    phone: body.telefono?.trim() || null,
    email: body.correo?.trim() || null,
    notes: body.notas?.trim() || null,
  };

  const proveedor = body.id
    ? await prisma.supplier.update({ where: { id: body.id }, data: datos })
    : await prisma.supplier.create({ data: datos });

  return { id: proveedor.id, nombre: proveedor.name };
});

export { OPTIONS } from "@/lib/api";

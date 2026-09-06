import { param, withUser } from "@/lib/api";
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

/**
 * Borra un proveedor.
 *
 * Con compras registradas no se borra sin más: se llevaría por delante un
 * gasto que ya está contado en los reportes. Por defecto se apaga, que lo
 * saca de las listas sin tocar el historial. Con `conCompras=1` —que la app
 * solo manda después de decir cuántas son y preguntar— se va todo, que es lo
 * que hace falta para limpiar los de prueba.
 */
export const DELETE = withUser(async ({ request }) => {
  const id = param(request, "id");
  const conCompras = param(request, "conCompras") === "1";
  if (!id) throw new Error("Falta el proveedor.");

  const proveedor = await prisma.supplier.findUnique({
    where: { id },
    select: { name: true, _count: { select: { purchases: true } } },
  });
  if (!proveedor) throw new Error("Ese proveedor ya no existe.");

  const compras = proveedor._count.purchases;

  if (compras > 0 && !conCompras) {
    await prisma.supplier.update({ where: { id }, data: { active: false } });
    return {
      id,
      borrado: false,
      compras,
      mensaje: `${proveedor.name} tiene ${compras} ${
        compras === 1 ? "compra" : "compras"
      } y no se puede borrar sin perderlas. Lo dejamos apagado.`,
    };
  }

  if (compras > 0) {
    await prisma.$transaction([
      prisma.purchase.deleteMany({ where: { supplierId: id } }),
      prisma.supplier.delete({ where: { id } }),
    ]);
    return {
      id,
      borrado: true,
      compras,
      mensaje: `${proveedor.name} y sus ${compras} ${
        compras === 1 ? "compra" : "compras"
      } se borraron.`,
    };
  }

  await prisma.supplier.delete({ where: { id } });
  return { id, borrado: true, compras: 0 };
});

export { OPTIONS } from "@/lib/api";

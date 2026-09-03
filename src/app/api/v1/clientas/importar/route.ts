import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/utils";

type Candidato = { nombre?: string; telefono?: string };

/**
 * Da de alta varias clientas de una sola vez, a partir de los contactos del
 * teléfono. Salta las que no tienen nombre o teléfono válidos y las que ya
 * existen (mismo teléfono): así se puede seleccionar la agenda entera sin
 * preocuparse de mandar duplicados.
 */
export const POST = withUser(async ({ request }) => {
  const body = (await request.json()) as { contactos?: Candidato[] };
  const contactos = body.contactos ?? [];
  if (contactos.length === 0) throw new Error("No llegó ningún contacto.");
  if (contactos.length > 500) {
    throw new Error("Como mucho 500 contactos por tanda.");
  }

  // Normalizamos y descartamos lo que no sirve antes de tocar la base.
  const limpios = new Map<string, string>(); // teléfono -> nombre
  let sinDatos = 0;
  for (const c of contactos) {
    const nombre = c.nombre?.trim() ?? "";
    const telefono = normalizePhone(c.telefono ?? "");
    if (nombre.length < 2 || telefono.length < 10) {
      sinDatos++;
      continue;
    }
    // Un contacto puede tener dos números guardados: nos quedamos con el
    // primero que llegue.
    if (!limpios.has(telefono)) limpios.set(telefono, nombre);
  }

  if (limpios.size === 0) {
    return { creadas: 0, existentes: 0, sinDatos, total: contactos.length };
  }

  const existentes = await prisma.client.findMany({
    where: { phone: { in: [...limpios.keys()] } },
    select: { phone: true },
  });
  const yaEstaban = new Set(existentes.map((e) => e.phone));

  const nuevos = [...limpios.entries()].filter(([tel]) => !yaEstaban.has(tel));

  if (nuevos.length > 0) {
    await prisma.client.createMany({
      data: nuevos.map(([telefono, nombre]) => ({ name: nombre, phone: telefono })),
    });
  }

  return {
    creadas: nuevos.length,
    existentes: yaEstaban.size,
    sinDatos,
    total: contactos.length,
  };
});

export { OPTIONS } from "@/lib/api";

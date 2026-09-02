import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

/** El equipo, con lo que sabe hacer cada una y su carga de la semana. */
export const GET = withUser(async () => {
  const desde = new Date();
  const hasta = new Date(desde.getTime() + 7 * 86_400_000);

  const especialistas = await prisma.specialist.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      skills: { select: { serviceId: true } },
      appointments: {
        where: { startAt: { gte: desde, lte: hasta }, status: { notIn: ["CANCELLED"] } },
        select: { id: true },
      },
    },
  });

  return {
    especialistas: especialistas.map((e) => ({
      id: e.id,
      nombre: e.name,
      color: e.color,
      telefono: e.phone,
      correo: e.email,
      activa: e.active,
      clave: e.pin,
      servicioIds: e.skills.map((s) => s.serviceId),
      citasSemana: e.appointments.length,
    })),
  };
});

/** Da de alta o edita a una especialista y lo que puede atender. */
export const POST = withUser(async ({ request }) => {
  const body = (await request.json()) as {
    id?: string;
    nombre?: string;
    clave?: string;
    telefono?: string | null;
    correo?: string | null;
    color?: string;
    activa?: boolean;
    servicioIds?: string[];
  };

  const nombre = body.nombre?.trim() ?? "";
  const clave = body.clave?.trim() ?? "";
  const servicioIds = body.servicioIds ?? [];

  if (nombre.length < 2) throw new Error("Escribe el nombre.");
  if (!/^\d{4}$/.test(clave)) throw new Error("La clave debe ser de 4 dígitos.");

  const datos = {
    name: nombre,
    pin: clave,
    phone: body.telefono?.trim() || null,
    email: body.correo?.trim() || null,
    color: body.color?.trim() || "#E9B21C",
    active: body.activa ?? true,
  };

  if (body.id) {
    const id = body.id;
    await prisma.$transaction([
      prisma.specialist.update({ where: { id }, data: datos }),
      prisma.specialistService.deleteMany({ where: { specialistId: id } }),
      ...(servicioIds.length > 0
        ? [
            prisma.specialistService.createMany({
              data: servicioIds.map((serviceId) => ({ specialistId: id, serviceId })),
            }),
          ]
        : []),
    ]);
    return { id };
  }

  // El slug identifica a la especialista en su propia entrada; no puede repetirse.
  let slug = slugify(nombre);
  if (await prisma.specialist.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const especialista = await prisma.specialist.create({
    data: { ...datos, slug, skills: { create: servicioIds.map((serviceId) => ({ serviceId })) } },
  });

  return { id: especialista.id };
});

/** Enciende o apaga a una especialista sin tocar su ficha. */
export const PATCH = withUser(async ({ request }) => {
  const body = (await request.json()) as { id?: string; activa?: boolean };
  if (!body.id) throw new Error("Falta la especialista.");

  const actual = await prisma.specialist.findUnique({
    where: { id: body.id },
    select: { active: true },
  });
  if (!actual) throw new Error("Esa especialista ya no existe.");

  const activa = body.activa ?? !actual.active;
  await prisma.specialist.update({ where: { id: body.id }, data: { active: activa } });
  return { id: body.id, activa };
});

export { OPTIONS } from "@/lib/api";

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import {
  fail,
  ok,
  readBool,
  readCents,
  readInt,
  readList,
  readOptional,
  readString,
  requireUser,
  toMessage,
  type ActionState,
} from "@/actions/shared";
import type { CategoryKind, HairRemovalMethod } from "@/generated/prisma/client";

function revalidateCatalog() {
  revalidatePath("/panel/servicios");
  revalidatePath("/panel/bonos");
  revalidatePath("/panel/especialistas");
  revalidatePath("/panel/agenda/nueva");
  revalidatePath("/reservar/nueva");
}

// --- Categorías -----------------------------------------------------------

export async function saveCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();

    const id = readString(formData, "id");
    const name = readString(formData, "name");
    if (name.length < 2) return fail("Escribe el nombre de la categoría.");

    const data = {
      name,
      kind: (readString(formData, "kind") || "OTHER") as CategoryKind,
      color: readString(formData, "color") || "#E9B21C",
      order: readInt(formData, "order", 0),
    };

    if (id) {
      await prisma.category.update({ where: { id }, data });
    } else {
      let slug = slugify(name);
      const exists = await prisma.category.findUnique({ where: { slug } });
      if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      await prisma.category.create({ data: { ...data, slug } });
    }

    revalidateCatalog();
    return ok("Categoría guardada.");
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function deleteCategoryAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const services = await prisma.service.count({ where: { categoryId: id } });
  if (services > 0) {
    await prisma.category.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.category.delete({ where: { id } });
  }
  revalidateCatalog();
}

// --- Servicios ------------------------------------------------------------

export async function saveServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();

    const id = readString(formData, "id");
    const name = readString(formData, "name");
    const categoryId = readString(formData, "categoryId");
    const durationMin = readInt(formData, "durationMin", 60);

    if (name.length < 2) return fail("Escribe el nombre del servicio.");
    if (!categoryId) return fail("Elige una categoría.");
    if (durationMin < 5) return fail("La duración mínima es de 5 minutos.");

    const sessionInterval = readInt(formData, "sessionIntervalDays", 0);

    const data = {
      name,
      description: readOptional(formData, "description"),
      priceCents: readCents(formData, "price"),
      durationMin,
      categoryId,
      active: readBool(formData, "active"),
      order: readInt(formData, "order", 0),
      bodyZone: readOptional(formData, "bodyZone"),
      method: (readString(formData, "method") || "NONE") as HairRemovalMethod,
      sessionIntervalDays: sessionInterval > 0 ? sessionInterval : null,
      requiresPatchTest: readBool(formData, "requiresPatchTest"),
    };

    const service = id
      ? await prisma.service.update({ where: { id }, data })
      : await prisma.service.create({ data });

    revalidateCatalog();
    return ok(id ? "Servicio actualizado." : "Servicio creado.", service.id);
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function toggleServiceActiveAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const service = await prisma.service.findUnique({ where: { id }, select: { active: true } });
  if (!service) return;
  await prisma.service.update({ where: { id }, data: { active: !service.active } });
  revalidateCatalog();
}

export async function deleteServiceAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const used = await prisma.appointmentService.count({ where: { serviceId: id } });
  if (used > 0) {
    await prisma.service.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.service.delete({ where: { id } });
  }
  revalidateCatalog();
}

// --- Bonos ----------------------------------------------------------------

export async function savePackageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();

    const id = readString(formData, "id");
    const name = readString(formData, "name");
    const sessions = readInt(formData, "sessions", 6);
    const serviceIds = readList(formData, "serviceIds");

    if (name.length < 2) return fail("Escribe el nombre del bono.");
    if (sessions < 2) return fail("Un bono necesita al menos 2 sesiones.");
    if (serviceIds.length === 0) return fail("Elige qué servicios cubre el bono.");

    const data = {
      name,
      description: readOptional(formData, "description"),
      sessions,
      priceCents: readCents(formData, "price"),
      validityDays: readInt(formData, "validityDays", 365),
      active: readBool(formData, "active"),
    };

    if (id) {
      await prisma.$transaction([
        prisma.package.update({ where: { id }, data }),
        prisma.packageService.deleteMany({ where: { packageId: id } }),
        prisma.packageService.createMany({
          data: serviceIds.map((serviceId) => ({ packageId: id, serviceId })),
        }),
      ]);
      revalidateCatalog();
      return ok("Bono actualizado.", id);
    }

    const pkg = await prisma.package.create({
      data: { ...data, services: { create: serviceIds.map((serviceId) => ({ serviceId })) } },
    });

    revalidateCatalog();
    return ok("Bono creado.", pkg.id);
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function deletePackageAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const sold = await prisma.clientPackage.count({ where: { packageId: id } });
  if (sold > 0) {
    await prisma.package.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.package.delete({ where: { id } });
  }
  revalidateCatalog();
}

// --- Especialistas --------------------------------------------------------

export async function saveSpecialistAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();

    const id = readString(formData, "id");
    const name = readString(formData, "name");
    const pin = readString(formData, "pin");
    const serviceIds = readList(formData, "serviceIds");

    if (name.length < 2) return fail("Escribe el nombre.");
    if (!/^\d{4}$/.test(pin)) return fail("La clave debe ser de 4 dígitos.");

    const data = {
      name,
      pin,
      phone: readOptional(formData, "phone"),
      email: readOptional(formData, "email"),
      color: readString(formData, "color") || "#E9B21C",
      active: readBool(formData, "active"),
    };

    if (id) {
      await prisma.$transaction([
        prisma.specialist.update({ where: { id }, data }),
        prisma.specialistService.deleteMany({ where: { specialistId: id } }),
        ...(serviceIds.length > 0
          ? [
              prisma.specialistService.createMany({
                data: serviceIds.map((serviceId) => ({ specialistId: id, serviceId })),
              }),
            ]
          : []),
      ]);
      revalidateCatalog();
      return ok("Especialista actualizada.", id);
    }

    let slug = slugify(name);
    const exists = await prisma.specialist.findUnique({ where: { slug } });
    if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const specialist = await prisma.specialist.create({
      data: {
        ...data,
        slug,
        skills: { create: serviceIds.map((serviceId) => ({ serviceId })) },
      },
    });

    revalidateCatalog();
    return ok("Especialista registrada.", specialist.id);
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function toggleSpecialistActiveAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const specialist = await prisma.specialist.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!specialist) return;
  await prisma.specialist.update({ where: { id }, data: { active: !specialist.active } });
  revalidateCatalog();
}

export async function deleteSpecialistAction(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const appointments = await prisma.appointment.count({ where: { specialistId: id } });
  if (appointments > 0) {
    await prisma.specialist.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.specialist.delete({ where: { id } });
  }
  revalidateCatalog();
}

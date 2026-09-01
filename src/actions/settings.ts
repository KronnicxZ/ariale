"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  fail,
  ok,
  readBool,
  readInt,
  readNumber,
  readOptional,
  readString,
  requireUser,
  toMessage,
  type ActionState,
} from "@/actions/shared";

const HEX = /^#[0-9a-fA-F]{6}$/;

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function saveIdentityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();
    const businessName = readString(formData, "businessName");
    if (businessName.length < 2) return fail("Escribe el nombre del negocio.");

    await prisma.settings.update({
      where: { id: (await getSettings()).id },
      data: {
        businessName,
        tagline: readString(formData, "tagline"),
        logoUrl: readOptional(formData, "logoUrl"),
        phone: readOptional(formData, "phone"),
        whatsapp: readOptional(formData, "whatsapp"),
        instagram: readOptional(formData, "instagram")?.replace("@", "") ?? null,
        address: readOptional(formData, "address"),
      },
    });

    revalidateAll();
    return ok("Datos del negocio actualizados.");
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function saveScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();
    const settings = await getSettings();

    const slotMinutes = readInt(formData, "slotMinutes", 30);
    if (![10, 15, 20, 30, 45, 60].includes(slotMinutes)) {
      return fail("El intervalo debe ser de 10, 15, 20, 30, 45 o 60 minutos.");
    }

    await prisma.settings.update({
      where: { id: settings.id },
      data: {
        slotMinutes,
        minHoursAhead: readInt(formData, "minHoursAhead", 1),
        maxDaysAhead: readInt(formData, "maxDaysAhead", 45),
      },
    });

    // Un bloque por día de la semana.
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const enabled = readBool(formData, `enabled-${dayOfWeek}`);
      const openTime = readString(formData, `open-${dayOfWeek}`) || "09:00";
      const closeTime = readString(formData, `close-${dayOfWeek}`) || "18:00";
      if (openTime >= closeTime) {
        return fail(`En uno de los días la hora de cierre no puede ser anterior a la de apertura.`);
      }
      await prisma.workingHour.upsert({
        where: { dayOfWeek },
        create: { dayOfWeek, enabled, openTime, closeTime },
        update: { enabled, openTime, closeTime },
      });
    }

    revalidateAll();
    return ok("Horario guardado.");
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function saveCurrencyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();
    const settings = await getSettings();

    const rateMode = readString(formData, "rateMode") === "MANUAL" ? "MANUAL" : "AUTO";
    const manualRate = readNumber(formData, "manualRate");

    if (rateMode === "MANUAL" && manualRate <= 0) {
      return fail("Escribe la tasa en bolívares por dólar.");
    }

    await prisma.settings.update({
      where: { id: settings.id },
      data: {
        rateMode,
        manualRate,
        currencyLabel: readString(formData, "currencyLabel") || "Dólar BCV",
        countryCode: readString(formData, "countryCode") || "+58",
        timezone: readString(formData, "timezone") || "America/Caracas",
      },
    });

    revalidateAll();
    return ok("Moneda actualizada.");
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function saveAppearanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireUser();
    const settings = await getSettings();

    const accentColor = readString(formData, "accentColor");
    const menuColor = readString(formData, "menuColor");

    if (!HEX.test(accentColor) || !HEX.test(menuColor)) {
      return fail("Los colores deben ser hexadecimales, como #E9B21C.");
    }

    await prisma.settings.update({
      where: { id: settings.id },
      data: { accentColor, menuColor },
    });

    revalidateAll();
    return ok("Colores guardados.");
  } catch (error) {
    return fail(toMessage(error));
  }
}

export async function setAutoConfirmAction(enabled: boolean) {
  await requireUser();
  const settings = await getSettings();
  await prisma.settings.update({ where: { id: settings.id }, data: { autoConfirm: enabled } });
  revalidatePath("/panel/agenda/enlaces");
  revalidatePath("/reservar/nueva");
}

/** Fuerza una nueva consulta de la tasa BCV, borrando la del día. */
export async function refreshRateAction() {
  await requireUser();
  const settings = await getSettings();
  const today = new Date();
  const day = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  await prisma.exchangeRate.deleteMany({ where: { date: { gte: day } } });
  void settings;
  revalidateAll();
}

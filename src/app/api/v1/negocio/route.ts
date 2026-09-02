import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getSettings, getWorkingHours } from "@/lib/settings";
import { getRate } from "@/lib/rate";

/** Los datos del estudio y su horario, para la pantalla de ajustes. */
export const GET = withUser(async ({ user }) => {
  const [settings, hours, rate] = await Promise.all([
    getSettings(),
    getWorkingHours(),
    getRate(),
  ]);

  return {
    negocio: {
      nombre: settings.businessName,
      lema: settings.tagline,
      telefono: settings.phone,
      whatsapp: settings.whatsapp,
      instagram: settings.instagram,
      direccion: settings.address,
      prefijo: settings.countryCode,
      zonaHoraria: settings.timezone,
      intervaloMin: settings.slotMinutes,
      confirmarAuto: settings.autoConfirm,
      diasMaximo: settings.maxDaysAhead,
      horasMinimas: settings.minHoursAhead,
      monedaEtiqueta: settings.currencyLabel,
      modoTasa: settings.rateMode,
      tasaManual: settings.manualRate,
    },
    tasa: { valor: rate.rate, fuente: rate.source, desactualizada: rate.stale },
    horario: hours.map((h) => ({
      dia: h.dayOfWeek,
      abierto: h.enabled,
      desde: h.openTime,
      hasta: h.closeTime,
    })),
    usuaria: {
      id: user.id,
      nombre: user.name,
      correo: user.email,
      rol: user.role,
      especialistaId: user.specialistId,
    },
  };
});

/** Guarda identidad, horario o reglas de agenda; solo lo que venga en el cuerpo. */
export const PATCH = withUser(async ({ request }) => {
  const body = (await request.json()) as {
    nombre?: string;
    lema?: string;
    telefono?: string | null;
    whatsapp?: string | null;
    instagram?: string | null;
    direccion?: string | null;
    intervaloMin?: number;
    confirmarAuto?: boolean;
    diasMaximo?: number;
    horasMinimas?: number;
    horario?: { dia: number; abierto: boolean; desde: string; hasta: string }[];
  };

  const settings = await getSettings();

  if (body.nombre !== undefined && body.nombre.trim().length < 2) {
    throw new Error("Escribe el nombre del negocio.");
  }
  if (body.intervaloMin !== undefined && ![10, 15, 20, 30, 45, 60].includes(body.intervaloMin)) {
    throw new Error("El intervalo debe ser de 10, 15, 20, 30, 45 o 60 minutos.");
  }

  await prisma.settings.update({
    where: { id: settings.id },
    data: {
      ...(body.nombre !== undefined ? { businessName: body.nombre.trim() } : {}),
      ...(body.lema !== undefined ? { tagline: body.lema.trim() } : {}),
      ...(body.telefono !== undefined ? { phone: body.telefono?.trim() || null } : {}),
      ...(body.whatsapp !== undefined ? { whatsapp: body.whatsapp?.trim() || null } : {}),
      ...(body.instagram !== undefined
        ? { instagram: body.instagram?.replace("@", "").trim() || null }
        : {}),
      ...(body.direccion !== undefined ? { address: body.direccion?.trim() || null } : {}),
      ...(body.intervaloMin !== undefined ? { slotMinutes: body.intervaloMin } : {}),
      ...(body.confirmarAuto !== undefined ? { autoConfirm: body.confirmarAuto } : {}),
      ...(body.diasMaximo !== undefined ? { maxDaysAhead: body.diasMaximo } : {}),
      ...(body.horasMinimas !== undefined ? { minHoursAhead: body.horasMinimas } : {}),
    },
  });

  for (const dia of body.horario ?? []) {
    if (dia.abierto && dia.desde >= dia.hasta) {
      throw new Error("La hora de cierre no puede ser anterior a la de apertura.");
    }
    await prisma.workingHour.upsert({
      where: { dayOfWeek: dia.dia },
      create: {
        dayOfWeek: dia.dia,
        enabled: dia.abierto,
        openTime: dia.desde,
        closeTime: dia.hasta,
      },
      update: { enabled: dia.abierto, openTime: dia.desde, closeTime: dia.hasta },
    });
  }

  return { guardado: true };
});

export { OPTIONS } from "@/lib/api";

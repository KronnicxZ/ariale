export type ServiceOption = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMin: number;
  bodyZone: string | null;
  requiresPatchTest: boolean;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  /** Define el área (uñas/pies o depilación) y con ello a quién le toca. */
  categoryKind: "MANICURE" | "PEDICURE" | "DEPILATION" | "OTHER";
};

/** Dos áreas en el estudio: Alejandra lleva uñas y pies; Arianny, depilación. */
export function areaDe(kind: ServiceOption["categoryKind"]) {
  return kind === "DEPILATION" ? "depilacion" : "unas";
}

export type SpecialistOption = {
  id: string;
  name: string;
  color: string;
  serviceIds: string[];
};

export type ClientOption = {
  id: string;
  name: string;
  phone: string;
};

/** Bono con saldo que la clienta puede usar en esta cita. */
export type PackageBalance = {
  id: string;
  name: string;
  remaining: number;
  serviceIds: string[];
};

/** Quien reserva, cuando se identifica al confirmar y no al entrar. */
export type QuienReserva = { phone: string; name?: string };

/**
 * El asistente pide el nombre solo cuando el teléfono no está registrado.
 * Viaja como "error" de la reserva porque no lo es del todo: es el formulario
 * pidiendo un dato más, igual que hacía la pantalla de entrada.
 */
export const FALTA_NOMBRE = "NEEDS_NAME";

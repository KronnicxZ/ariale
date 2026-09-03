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

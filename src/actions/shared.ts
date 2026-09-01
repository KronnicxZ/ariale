import "server-only";
import { getCurrentUser } from "@/lib/auth";

export type ActionState = { error?: string; success?: string; id?: string } | null;

export function fail(message: string): ActionState {
  return { error: message };
}

export function ok(message: string, id?: string): ActionState {
  return { success: message, id };
}

/** Toda acción del panel pasa por aquí; devuelve null si la sesión caducó. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("SESSION_EXPIRED");
  return user;
}

export function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function readOptional(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value || null;
}

export function readNumber(formData: FormData, key: string) {
  const raw = readString(formData, key).replace(",", ".");
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

export function readCents(formData: FormData, key: string) {
  return Math.round(readNumber(formData, key) * 100);
}

export function readInt(formData: FormData, key: string, fallback = 0) {
  const value = parseInt(readString(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

export function readBool(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function readList(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

/** Convierte el error de una acción en un mensaje entendible. */
export function toMessage(error: unknown, fallback = "Algo salió mal. Intenta de nuevo.") {
  if (error instanceof Error) {
    if (error.message === "SESSION_EXPIRED") return "Tu sesión caducó. Entra de nuevo.";
    if (error.message.startsWith("Unique constraint")) return "Ese registro ya existe.";
  }
  return fallback;
}

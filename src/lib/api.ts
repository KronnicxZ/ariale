import "server-only";
import { getApiUser } from "@/lib/api-auth";
import { periodFromParams } from "@/lib/period";
import type { PeriodPreset } from "@/lib/date";

/**
 * Andamiaje común de la API que consume la app móvil.
 *
 * Todas las respuestas son JSON y todos los importes van en centavos de USD,
 * igual que en la base de datos: la app formatea al mostrar.
 */

/**
 * La app móvil se autentica con un token Bearer, no con cookies, así que
 * abrir CORS no expone la sesión de nadie: sin credenciales ambientales no
 * hay riesgo de que otra web actúe en nombre de la usuaria.
 */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

/** Responde al preflight del navegador. Las rutas lo reexportan. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { ...CORS, ...(init?.headers ?? {}) },
  });
}

export function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: CORS });
}

export const unauthorized = () => bad("Sesión no válida.", 401);
export const notFound = () => bad("No encontrado.", 404);

/**
 * Envuelve un handler que necesita sesión. Centraliza el 401 y convierte
 * cualquier excepción en un 500 con mensaje legible, para que la app nunca
 * reciba un HTML de error.
 */
export function withUser<T>(
  handler: (context: {
    request: Request;
    user: NonNullable<Awaited<ReturnType<typeof getApiUser>>>;
  }) => Promise<T>,
) {
  return async (request: Request) => {
    const user = await getApiUser(request);
    if (!user) return unauthorized();
    try {
      return ok(await handler({ request, user }));
    } catch (error) {
      console.error("[api]", error);
      const message = error instanceof Error ? error.message : "Error inesperado.";
      return bad(message, 500);
    }
  };
}

/** Igual, pero para rutas con parámetros dinámicos (`[id]`). */
export function withUserParams<P extends Record<string, string>, T>(
  handler: (context: {
    request: Request;
    params: P;
    user: NonNullable<Awaited<ReturnType<typeof getApiUser>>>;
  }) => Promise<T>,
) {
  return async (request: Request, context: { params: Promise<P> }) => {
    const user = await getApiUser(request);
    if (!user) return unauthorized();
    try {
      const params = await context.params;
      return ok(await handler({ request, params, user }));
    } catch (error) {
      console.error("[api]", error);
      const message = error instanceof Error ? error.message : "Error inesperado.";
      return bad(message, 500);
    }
  };
}

/** Lee los parámetros de consulta de la URL. */
export function query(request: Request) {
  return new URL(request.url).searchParams;
}

export function param(request: Request, key: string) {
  const value = query(request).get(key);
  return value && value.trim() ? value.trim() : undefined;
}

/**
 * Lee ?periodo=&desde=&hasta= igual que la web, así que un atajo significa
 * lo mismo en los dos sitios y los totales siempre cuadran.
 */
export function periodParam(request: Request, fallback: PeriodPreset = "month") {
  const params = Object.fromEntries(query(request).entries());
  return periodFromParams(params, fallback);
}

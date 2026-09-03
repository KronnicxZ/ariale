import { NextResponse, type NextRequest } from "next/server";

/**
 * ariale.space es la portada pública del estudio; app.ariale.space (y
 * cualquier otro dominio, como el de Vercel) es la app de siempre —
 * iniciar sesión, el panel y reservar cita. Los dos dominios apuntan al
 * mismo despliegue, así que la única diferencia está aquí: en el dominio
 * raíz, la portada reemplaza el redirect a /login.
 */
const DOMINIOS_PORTADA = new Set(["ariale.space", "www.ariale.space"]);

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  if (DOMINIOS_PORTADA.has(host) && request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/portada", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};

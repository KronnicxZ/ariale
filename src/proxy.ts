import { NextResponse, type NextRequest } from "next/server";

/**
 * www.ariale.space es la portada pública del estudio; app.ariale.space (y
 * cualquier otro dominio, como el de Vercel) es la app de siempre —
 * iniciar sesión, el panel y reservar cita. Los dos dominios apuntan al
 * mismo despliegue, así que la única diferencia está aquí.
 *
 * La portada vive en la raíz y solo en la raíz: "/portada" nunca se ve en
 * la barra del navegador — en el dominio público se manda a "/", y en los
 * demás a la portada de verdad.
 */
const DOMINIOS_PORTADA = new Set([
  "ariale.space",
  "www.ariale.space",
  // En local también, o la portada no se puede ver mientras se trabaja en
  // ella: "/portada" se iría redirigido al sitio ya publicado.
  "localhost",
  "127.0.0.1",
]);
const PORTADA_CANONICA = "https://www.ariale.space/";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  const { pathname } = request.nextUrl;
  const esPortada = DOMINIOS_PORTADA.has(host);

  if (pathname === "/" && esPortada) {
    return NextResponse.rewrite(new URL("/portada", request.url));
  }

  if (pathname === "/portada") {
    return NextResponse.redirect(esPortada ? new URL("/", request.url) : PORTADA_CANONICA, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/portada"],
};

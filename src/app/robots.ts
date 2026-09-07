import type { MetadataRoute } from "next";
import { SITIO } from "@/lib/seo";

/**
 * Qué puede mirar un buscador.
 *
 * Público hay dos cosas: la portada y la página de agendar. Todo lo demás
 * —el panel, la agenda de cada especialista, el acceso— es de puertas
 * adentro, y aunque ya pide sesión, no tiene por qué salir en Google.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/panel", "/login", "/agenda", "/demo", "/api", "/reservar/historial"],
    },
    sitemap: `${SITIO}/sitemap.xml`,
  };
}

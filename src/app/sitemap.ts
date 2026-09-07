import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { SITIO } from "@/lib/seo";

/**
 * Las dos páginas públicas.
 *
 * La fecha de la portada es la de la última vez que se tocó la
 * configuración del negocio: precios, horario o dirección. Es lo que de
 * verdad cambia ahí, y así el buscador vuelve a pasar cuando cambia.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSettings();

  return [
    {
      url: `${SITIO}/`,
      lastModified: settings.updatedAt,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITIO}/reservar`,
      lastModified: settings.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}

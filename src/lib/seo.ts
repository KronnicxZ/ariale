import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getSettings, getWorkingHours } from "@/lib/settings";
import type { CategoryKind } from "@/generated/prisma/client";

/**
 * Lo que hace falta para que la página se vea bien fuera de la página: en la
 * pestaña del navegador, en el resultado de Google y en la tarjeta que sale
 * al pegar el enlace en WhatsApp.
 *
 * Todo sale de la configuración del panel y del catálogo: si mañana se mudan
 * de ciudad o dejan de hacer pedicura, el título y la descripción cambian
 * solos. Escribirlo a mano aquí sería una tercera copia que se queda vieja.
 */

/** El dominio público. El otro, app.ariale.space, es el mismo despliegue. */
export const SITIO = "https://www.ariale.space";

/** "Urbanización Libertad, casa 21A, Ciudad Ojeda" → "Ciudad Ojeda". */
export function ciudadDe(direccion: string | null | undefined) {
  return direccion?.split(",").at(-1)?.trim() || null;
}

// En este orden, no en el del catálogo: se lee de lo más buscado a lo menos.
// En el título va la palabra corta —ahí sobran sesenta caracteres y "cejas y
// depilación" deja un "y ... y" que se lee mal—; en la descripción, la larga.
const AREAS: { kind: CategoryKind; corta: string; larga: string }[] = [
  { kind: "MANICURE", corta: "Uñas", larga: "Uñas" },
  { kind: "PEDICURE", corta: "pedicura", larga: "pedicura" },
  { kind: "DEPILATION", corta: "cejas", larga: "cejas y depilación" },
];

/** ["Uñas","pedicura","cejas"] → "Uñas, pedicura y cejas". */
function enumerar(palabras: string[]) {
  if (palabras.length === 0) return "";
  if (palabras.length === 1) return palabras[0];
  return `${palabras.slice(0, -1).join(", ")} y ${palabras.at(-1)}`;
}

/** Las áreas que hoy tienen servicios a la venta. Una sola vez por petición. */
export const areasActivas = cache(async () => {
  const categorias = await prisma.category.findMany({
    where: { active: true, services: { some: { active: true } } },
    select: { kind: true },
  });
  return new Set(categorias.map((c) => c.kind));
});

/**
 * El título y la descripción de la portada, armados con lo que de verdad
 * hay. `kinds` son las áreas activas del catálogo.
 */
export async function textosSeo(kinds?: Set<CategoryKind>) {
  kinds ??= await areasActivas();
  const settings = await getSettings();
  const ciudad = ciudadDe(settings.address);
  const presentes = AREAS.filter((a) => kinds.has(a.kind));
  const que = enumerar(presentes.map((a) => a.corta)) || "Belleza";
  const todo = presentes.map((a) => a.larga).join(", ") || "Belleza";
  const donde = ciudad ? ` en ${ciudad}` : "";

  return {
    ciudad,
    // Sin "Inicio ·" delante: en la pestaña y en Google el primer golpe de
    // vista tiene que decir quién es y qué hace, no en qué página estás.
    titulo: `${settings.businessName} · ${que}${donde}`,
    descripcion: `${todo}${donde}. Mira los precios y agenda tu cita en línea en un minuto: eliges el día y la hora, sin esperar respuesta.`,
    palabras: [
      "manicura",
      "uñas acrílicas",
      "semipermanente",
      "pedicura",
      "diseño de cejas",
      "laminado de cejas",
      "depilación",
      ...(ciudad ? [ciudad, `manicurista ${ciudad}`, `salón de belleza ${ciudad}`] : []),
      settings.businessName,
    ],
  };
}

/**
 * La ficha del negocio para Google, en el formato que entiende.
 *
 * Es lo que hace que aparezcan el horario, la dirección y el teléfono en el
 * resultado de búsqueda en vez de un enlace pelado. Los servicios van con su
 * precio: son públicos en la página, no hay nada que esconder.
 */
export async function fichaDelNegocio(
  servicios: { name: string; priceCents: number; category: { name: string } }[],
) {
  const [settings, horario] = await Promise.all([getSettings(), getWorkingHours()]);
  const ciudad = ciudadDe(settings.address);

  const DIAS_SCHEMA = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  return {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    "@id": `${SITIO}/#negocio`,
    name: settings.businessName,
    description: settings.tagline,
    url: SITIO,
    image: `${SITIO}/og-ariale.jpg`,
    logo: `${SITIO}/marca/logo-ariale.png`,
    // Un dólar: los precios van de $3 a $30, no es un sitio caro.
    priceRange: "$",
    currenciesAccepted: "USD, VES",
    ...(settings.phone ? { telephone: `+58${settings.phone.replace(/^0/, "")}` } : {}),
    ...(settings.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: settings.address,
            ...(ciudad ? { addressLocality: ciudad } : {}),
            addressCountry: "VE",
          },
        }
      : {}),
    ...(settings.instagram
      ? { sameAs: [`https://www.instagram.com/${settings.instagram}`] }
      : {}),
    openingHoursSpecification: horario
      .filter((h) => h.enabled)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: DIAS_SCHEMA[h.dayOfWeek],
        opens: h.openTime,
        closes: h.closeTime,
      })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Servicios",
      itemListElement: servicios.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.name, category: s.category.name },
        price: (s.priceCents / 100).toFixed(2),
        priceCurrency: "USD",
      })),
    },
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITIO}/reservar`,
        actionPlatform: [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform",
        ],
      },
      result: { "@type": "Reservation", name: "Cita" },
    },
  };
}

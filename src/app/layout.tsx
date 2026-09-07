import type { Metadata, Viewport } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BrandTheme } from "@/components/brand-theme";
import { getSettings } from "@/lib/settings";
import { SITIO, textosSeo } from "@/lib/seo";
import "./globals.css";

// Plus Jakarta Sans en toda la interfaz: geométrica y actual, con cifras
// tabulares y una "a" y un "1" que no se confunden en pantalla pequeña.
const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Playfair Display solo en títulos grandes: es la serif de contraste alto
// que usan las marcas de belleza, moderna y con presencia. Nunca baja a
// texto pequeño ni a cifras, donde no se leería igual de bien.
const heading = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const [settings, textos] = await Promise.all([getSettings(), textosSeo()]);

  return {
    // Sin esto, cualquier ruta relativa —la imagen para compartir, la
    // canónica— se queda a medias y los buscadores la descartan.
    metadataBase: new URL(SITIO),
    title: {
      // El título por defecto ya vende: quién es, qué hace y dónde. Las
      // páginas de dentro le añaden lo suyo delante con la plantilla.
      default: textos.titulo,
      template: `%s · ${settings.businessName}`,
    },
    description: textos.descripcion,
    keywords: textos.palabras,
    applicationName: settings.businessName,
    appleWebApp: { capable: true, title: settings.businessName, statusBarStyle: "default" },
    formatDetection: { telephone: false },
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: settings.businessName,
      locale: "es_VE",
      url: SITIO,
      title: textos.titulo,
      description: textos.descripcion,
      images: [
        {
          url: "/og-ariale.jpg",
          width: 1200,
          height: 630,
          alt: settings.businessName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: textos.titulo,
      description: textos.descripcion,
      images: ["/og-ariale.jpg"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1013" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();

  return (
    <html
      lang="es"
      className={`${sans.variable} ${heading.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <BrandTheme accent={settings.accentColor} menu={settings.menuColor} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}

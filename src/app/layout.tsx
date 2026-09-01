import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BrandTheme } from "@/components/brand-theme";
import { getSettings } from "@/lib/settings";
import "./globals.css";

// Inter para toda la interfaz: es la más legible en pantallas pequeñas y
// tiene cifras tabulares, que es lo que necesitan las tablas de dinero.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Serif fina, solo para títulos grandes. Le da el aire de spa sin
// comprometer la lectura, porque nunca se usa en texto pequeño ni en cifras.
const heading = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: {
      default: settings.businessName,
      template: `%s · ${settings.businessName}`,
    },
    description: settings.tagline,
    applicationName: settings.businessName,
    appleWebApp: { capable: true, title: settings.businessName, statusBarStyle: "default" },
    formatDetection: { telephone: false },
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

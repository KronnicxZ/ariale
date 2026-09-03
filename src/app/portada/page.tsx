import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, Clock, Droplets, Footprints, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSettings, getWorkingHours } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";
import { DAY_SHORT } from "@/lib/date";
import type { CategoryKind } from "@/generated/prisma/client";

export const metadata = { title: "Inicio" };

const ICONO_POR_TIPO: Record<CategoryKind, typeof Sparkles> = {
  MANICURE: Sparkles,
  PEDICURE: Footprints,
  DEPILATION: Droplets,
  OTHER: Sparkles,
};

const DESCRIPCION_POR_TIPO: Record<CategoryKind, string> = {
  MANICURE: "Esmaltado, sistemas y diseño de uñas.",
  PEDICURE: "Pedicura spa y semipermanente.",
  DEPILATION: "Cera y diseño, a tu medida.",
  OTHER: "Consulta el detalle al reservar.",
};

const FOTO_POR_TIPO: Record<CategoryKind, string> = {
  MANICURE: "/trabajos/manicure-rojo-oro.jpg",
  PEDICURE: "/trabajos/pedicura.jpg",
  DEPILATION: "/trabajos/depilacion-cejas.jpg",
  OTHER: "/trabajos/estudio-ambiente.jpg",
};

// Los dos números directos: cada quien recibe sus propias clientas.
const ESPECIALISTAS_WA = [
  { nombre: "Alejandra", telefono: "4246024354" },
  { nombre: "Arianny", telefono: "4246678187" },
];

const GALERIA = [
  { src: "/trabajos/manicure-rojo-oro.jpg", alt: "Manicura roja con acento dorado" },
  { src: "/trabajos/manicure-blanco-floral.jpg", alt: "Manicura blanca con diseño floral en dorado" },
  { src: "/trabajos/depilacion-cejas.jpg", alt: "Laminado de cejas" },
  { src: "/trabajos/manicure-borgona-lazo.jpg", alt: "Manicura borgoña con lazo y estrella dorada" },
  { src: "/trabajos/manicure-azul.jpg", alt: "Manicura azul lavanda" },
  { src: "/trabajos/manicure-corazones.jpg", alt: "Manicura roja con corazones" },
  { src: "/trabajos/pedicura.jpg", alt: "Pedicura" },
  { src: "/trabajos/manicure-animal-print.jpg", alt: "Manicura animal print" },
  { src: "/trabajos/manicure-nude-cromado.jpg", alt: "Manicura nude con cromado dorado" },
];

function Pill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="bg-primary/12 text-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition hover:opacity-80"
    >
      <MessageCircle className="size-4" />
      {children}
    </a>
  );
}

export default async function PortadaPage() {
  const [settings, workingHours, categories] = await Promise.all([
    getSettings(),
    getWorkingHours(),
    prisma.category.findMany({
      where: { active: true, services: { some: { active: true } } },
      orderBy: { order: "asc" },
      select: { id: true, name: true, kind: true },
    }),
  ]);

  const abiertos = workingHours
    .filter((h) => h.enabled)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const waEspecialistas = ESPECIALISTAS_WA.map((e) => ({
    ...e,
    href: waLink(e.telefono, `Hola ${e.nombre}, quisiera agendar una cita en ${settings.businessName}.`, "+58"),
  }));

  return (
    <div className="flex-1">
      {/* Hero: foto real del estudio, un solo CTA principal y las dos vías directas por WhatsApp */}
      <section className="relative flex min-h-[560px] items-end overflow-hidden sm:min-h-[640px]">
        <Image
          src="/trabajos/estudio-ambiente.jpg"
          alt=""
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />

        <div className="relative z-10 mx-auto w-full max-w-md px-5 pb-10 text-center text-white">
          <Image
            src="/marca/logo-ariale.png"
            alt={settings.businessName}
            width={72}
            height={72}
            className="mx-auto rounded-full"
          />
          <h1 className="font-display mt-4 text-4xl">{settings.businessName}</h1>
          <p className="mt-2 text-base text-balance text-white/85">{settings.tagline}</p>

          <Link
            href="/reservar"
            className="brand-gradient text-primary-foreground mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-semibold shadow-lg transition active:scale-[0.99]"
          >
            <CalendarPlus className="size-5" />
            Agendar mi cita
          </Link>

          <p className="mt-5 text-[0.68rem] font-semibold tracking-widest text-white/70 uppercase">
            O escríbele directo
          </p>
          <div className="mt-2.5 flex justify-center gap-2.5">
            {waEspecialistas.map((e) => (
              <a
                key={e.nombre}
                href={e.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25"
              >
                <MessageCircle className="size-4" />
                {e.nombre}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Qué hacemos, con foto real por categoría */}
      {categories.length > 0 ? (
        <section className="px-5 py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="label-caps text-muted-foreground text-center">Qué hacemos</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {categories.map((categoria) => {
                const Icono = ICONO_POR_TIPO[categoria.kind];
                return (
                  <div
                    key={categoria.id}
                    className="group relative aspect-[3/4] overflow-hidden rounded-3xl"
                  >
                    <Image
                      src={FOTO_POR_TIPO[categoria.kind]}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 33vw, 100vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <span className="mb-2 inline-flex size-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur">
                        <Icono className="size-4" />
                      </span>
                      <p className="font-display text-2xl text-white">{categoria.name}</p>
                      <p className="mt-1 text-sm text-white/80">
                        {DESCRIPCION_POR_TIPO[categoria.kind]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* Galería: el trabajo real, no un catálogo de stock */}
      <section className="px-5 pb-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="label-caps text-muted-foreground text-center">Nuestro trabajo</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-center text-sm text-balance">
            Cada diseño sale distinto según la clienta: esto es lo que ya hicimos.
          </p>
          <div className="mt-6 columns-2 gap-3 sm:columns-3">
            {GALERIA.map((foto) => (
              <div
                key={foto.src}
                className="surface-sm mb-3 overflow-hidden break-inside-avoid p-0"
              >
                <Image
                  src={foto.src}
                  alt={foto.alt}
                  width={480}
                  height={640}
                  sizes="(min-width: 640px) 33vw, 50vw"
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cierre: agendar de nuevo, las dos vías por WhatsApp, y dónde encontrarnos */}
      <section className="px-5 pb-16">
        <div className="surface mx-auto max-w-md space-y-5 p-6 text-center">
          <div>
            <h2 className="font-display text-2xl">¿Lista para tu cita?</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Agenda en línea o escríbele directo a quien necesitas.
            </p>
          </div>

          <Link
            href="/reservar"
            className="brand-gradient text-primary-foreground inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-semibold shadow-sm transition active:scale-[0.99]"
          >
            <CalendarPlus className="size-5" />
            Agendar mi cita
          </Link>

          <div className="flex flex-wrap justify-center gap-2.5">
            {waEspecialistas.map((e) => (
              <Pill key={e.nombre} href={e.href}>
                {e.nombre}
              </Pill>
            ))}
          </div>

          {(abiertos.length > 0 || settings.address) && (
            <div className="border-border/70 space-y-4 border-t pt-5 text-left">
              {abiertos.length > 0 ? (
                <div className="flex gap-3">
                  <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">Horario</p>
                    <p className="text-muted-foreground">
                      {abiertos
                        .map((h) => `${DAY_SHORT[h.dayOfWeek]} ${h.openTime}–${h.closeTime}`)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              ) : null}

              {settings.address ? (
                <div className="flex gap-3">
                  <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">Dónde estamos</p>
                    <p className="text-muted-foreground">{settings.address}</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <p className="text-muted-foreground mt-8 text-center text-xs">
          {settings.businessName}
          {settings.instagram ? ` · @${settings.instagram}` : ""}
        </p>
      </section>
    </div>
  );
}

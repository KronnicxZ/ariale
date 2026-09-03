import Image from "next/image";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarPlus,
  Clock,
  Droplets,
  Footprints,
  MapPin,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getSettings, getWorkingHours } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";
import { DAY_SHORT, fmtDuration } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Reveal } from "./reveal";
import type { CategoryKind } from "@/generated/prisma/client";

export const metadata = { title: "Inicio" };
// Horario, precios y fotos salen del panel: si algo cambia ahí, se tiene
// que ver aquí sin esperar a un redeploy.
export const dynamic = "force-dynamic";

const ICONO_POR_TIPO: Record<CategoryKind, typeof Sparkles> = {
  MANICURE: Sparkles,
  PEDICURE: Footprints,
  DEPILATION: Droplets,
  OTHER: Sparkles,
};

// Las mismas palabras que usan ellas para describir su trabajo.
const DESCRIPCION_POR_TIPO: Record<CategoryKind, string> = {
  MANICURE: "Arte y cuidado para tus manos.",
  PEDICURE: "Pedicura spa y semipermanente.",
  DEPILATION: "Diseñando la mirada que siempre soñaste.",
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

const RAZONES = [
  {
    icono: CalendarCheck,
    titulo: "Agenda al toque",
    texto: "Eliges día y hora tú misma, sin esperar a que te contesten.",
  },
  {
    icono: UserCheck,
    titulo: "Cada quien en lo suyo",
    texto: "Alejandra lleva uñas; Arianny, depilación. Nada de generalistas.",
  },
  {
    icono: Sparkles,
    titulo: "Un trabajo, no una plantilla",
    texto: "Cada diseño se piensa para la clienta que lo lleva puesto.",
  },
];

function WaPill({
  href,
  nombre,
  tono = "claro",
}: {
  href: string;
  nombre: string;
  tono?: "claro" | "oscuro";
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        tono === "oscuro"
          ? "inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25"
          : "bg-primary/12 text-primary inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition hover:opacity-80"
      }
    >
      <span className="grid size-5 place-items-center rounded-full bg-[#25D366] text-white">
        <WhatsAppIcon className="size-3" />
      </span>
      {nombre}
    </a>
  );
}

export default async function PortadaPage() {
  const [settings, workingHours, categories, servicios] = await Promise.all([
    getSettings(),
    getWorkingHours(),
    prisma.category.findMany({
      where: { active: true, services: { some: { active: true } } },
      orderBy: { order: "asc" },
      select: { id: true, name: true, kind: true },
    }),
    prisma.service.findMany({
      where: { active: true },
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        name: true,
        priceCents: true,
        durationMin: true,
        category: { select: { id: true, name: true, kind: true } },
      },
    }),
  ]);

  const abiertos = workingHours
    .filter((h) => h.enabled)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const waEspecialistas = ESPECIALISTAS_WA.map((e) => ({
    ...e,
    href: waLink(
      e.telefono,
      `Hola ${e.nombre}, quisiera agendar una cita en ${settings.businessName}.`,
      "+58",
    ),
  }));

  const serviciosPorCategoria = new Map<
    string,
    { nombre: string; kind: CategoryKind; items: typeof servicios }
  >();
  for (const s of servicios) {
    const key = s.category.id;
    if (!serviciosPorCategoria.has(key)) {
      serviciosPorCategoria.set(key, { nombre: s.category.name, kind: s.category.kind, items: [] });
    }
    serviciosPorCategoria.get(key)!.items.push(s);
  }

  return (
    <div className="flex-1">
      {/* Hero: foto real del estudio, un solo CTA principal y las dos vías directas por WhatsApp */}
      <section className="relative flex min-h-[600px] items-end overflow-hidden sm:min-h-[680px] lg:min-h-[760px]">
        <Image
          src="/trabajos/estudio-ambiente.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

        <div className="relative z-10 mx-auto w-full max-w-md px-5 pb-12 text-center text-white sm:pb-16 lg:max-w-2xl lg:pb-20">
          <Image
            src="/marca/logo-ariale.png"
            alt={settings.businessName}
            width={76}
            height={76}
            className="mx-auto rounded-full lg:size-24"
          />
          <h1 className="font-display mt-4 text-4xl sm:text-5xl lg:text-6xl">
            {settings.businessName}
          </h1>
          <p className="mt-2 text-base text-balance text-white/85 sm:text-lg">
            {settings.tagline}
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/reservar"
              className="brand-gradient text-primary-foreground inline-flex w-full items-center justify-center gap-2 rounded-2xl px-7 py-3.5 font-semibold shadow-lg transition active:scale-[0.99] sm:w-auto"
            >
              <CalendarPlus className="size-5" />
              Agendar mi cita
            </Link>

            <div className="flex items-center gap-2.5">
              {waEspecialistas.map((e) => (
                <WaPill key={e.nombre} href={e.href} nombre={e.nombre} tono="oscuro" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Por qué agendar con nosotras */}
      <section className="px-5 py-12 sm:py-16">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {RAZONES.map((r, i) => {
            const Icono = r.icono;
            return (
              <Reveal key={r.titulo} delay={i * 90}>
                <div className="text-center sm:text-left">
                  <span className="bg-primary/12 text-primary inline-flex size-11 items-center justify-center rounded-2xl">
                    <Icono className="size-5" />
                  </span>
                  <p className="font-display mt-3 text-lg">{r.titulo}</p>
                  <p className="text-muted-foreground mt-1 text-sm text-balance">{r.texto}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Qué hacemos, con foto real por categoría */}
      {categories.length > 0 ? (
        <section className="px-5 py-8 sm:py-10">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="label-caps text-muted-foreground text-center">Qué hacemos</h2>
            </Reveal>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 sm:gap-4">
              {categories.map((categoria, i) => {
                const Icono = ICONO_POR_TIPO[categoria.kind];
                return (
                  <Reveal key={categoria.id} delay={i * 100}>
                    <div className="group relative aspect-[3/4] overflow-hidden rounded-3xl sm:aspect-[4/5]">
                      <Image
                        src={FOTO_POR_TIPO[categoria.kind]}
                        alt=""
                        fill
                        sizes="(min-width: 640px) 33vw, 100vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                        <span className="mb-2 inline-flex size-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur">
                          <Icono className="size-4" />
                        </span>
                        <p className="font-display text-2xl text-white sm:text-3xl">
                          {categoria.name}
                        </p>
                        <p className="mt-1 text-sm text-white/80">
                          {DESCRIPCION_POR_TIPO[categoria.kind]}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* Servicios y precios reales, agrupados como en el estudio */}
      {serviciosPorCategoria.size > 0 ? (
        <section className="px-5 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <Reveal>
              <h2 className="label-caps text-muted-foreground text-center">Servicios y precios</h2>
              <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-center text-sm text-balance">
                Los mismos precios que verás al agendar, sin sorpresas.
              </p>
            </Reveal>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {[...serviciosPorCategoria.values()].map((grupo, i) => (
                <Reveal key={grupo.nombre} delay={i * 100}>
                  <div className="surface p-5 sm:p-6">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-primary/12 text-primary grid size-8 place-items-center rounded-full">
                        {(() => {
                          const Icono = ICONO_POR_TIPO[grupo.kind];
                          return <Icono className="size-4" />;
                        })()}
                      </span>
                      <h3 className="font-display text-xl">{grupo.nombre}</h3>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {grupo.items.map((s) => (
                        <li key={s.id} className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{s.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {fmtDuration(s.durationMin)}
                            </span>
                          </span>
                          <span className="border-border/70 mx-1 hidden flex-1 border-b border-dotted sm:block" />
                          <span className="shrink-0 text-sm font-semibold">
                            {formatUsd(s.priceCents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Galería: el trabajo real, no un catálogo de stock */}
      <section className="px-5 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="label-caps text-muted-foreground text-center">Nuestro trabajo</h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-center text-sm text-balance">
              Cada diseño sale distinto según la clienta: esto es lo que ya hicimos.
            </p>
          </Reveal>
          <div className="mt-6 columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
            {GALERIA.map((foto, i) => (
              <Reveal key={foto.src} delay={(i % 4) * 80}>
                <div className="surface-sm mb-3 overflow-hidden p-0 sm:mb-4">
                  <Image
                    src={foto.src}
                    alt={foto.alt}
                    width={480}
                    height={640}
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="w-full transition duration-500 hover:scale-105"
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* El equipo: dos personas, no una franquicia */}
      <section className="px-5 py-12 sm:py-16">
        <Reveal>
          <div className="mx-auto grid max-w-4xl items-center gap-8 sm:grid-cols-[minmax(0,280px)_1fr] sm:gap-10">
            <div className="mx-auto w-48 overflow-hidden rounded-3xl sm:w-full">
              <Image
                src="/equipo/alejandra-arianny.webp"
                alt={`Alejandra y Arianny, ${settings.businessName}`}
                width={560}
                height={746}
                className="w-full"
              />
            </div>
            <div className="text-center sm:text-left">
              <h2 className="label-caps text-muted-foreground">Quiénes somos</h2>
              <p className="font-display mt-2 text-3xl">Alejandra &amp; Arianny</p>
              <p className="text-muted-foreground mt-3 text-sm text-balance sm:text-base">
                Un sueño hecho realidad con amor, fe y mucho profesionalismo. Alejandra lleva
                las uñas: arte y cuidado para tus manos. Arianny lleva las cejas: diseñando la
                mirada que siempre soñaste. Cada quien en lo suyo, para que a ti te toque lo
                mejor de las dos.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5 sm:justify-start">
                {waEspecialistas.map((e) => (
                  <WaPill key={e.nombre} href={e.href} nombre={e.nombre} />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Cierre: agendar de nuevo, las dos vías por WhatsApp, y dónde encontrarnos */}
      <section className="px-5 pt-4 pb-24 sm:pb-16">
        <Reveal>
          <div className="surface mx-auto max-w-md space-y-5 p-6 text-center sm:p-8">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl">¿Lista para tu cita?</h2>
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
                <WaPill key={e.nombre} href={e.href} nombre={e.nombre} />
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
        </Reveal>

        <p className="text-muted-foreground mt-8 text-center text-xs">
          {settings.businessName}
          {settings.instagram ? ` · @${settings.instagram}` : ""}
        </p>
      </section>

      {/* Barra fija en el teléfono, para no tener que volver a subir a agendar */}
      <div className="bg-card/95 fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur sm:hidden">
        <Link
          href="/reservar"
          className="brand-gradient text-primary-foreground flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
        >
          <CalendarPlus className="size-4" />
          Agendar
        </Link>
        {waEspecialistas.map((e) => (
          <a
            key={e.nombre}
            href={e.href}
            target="_blank"
            rel="noreferrer"
            aria-label={`WhatsApp de ${e.nombre}`}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white"
          >
            <WhatsAppIcon className="size-5" />
          </a>
        ))}
      </div>
    </div>
  );
}

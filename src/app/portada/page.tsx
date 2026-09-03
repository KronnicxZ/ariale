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

/** Botón de WhatsApp con el glifo real, legible a cualquier tamaño. */
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
          ? "inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/12 py-2.5 pr-5 pl-2.5 text-[15px] font-medium text-white backdrop-blur transition hover:bg-white/22"
          : "border-border/70 bg-card inline-flex items-center gap-2.5 rounded-full border py-2.5 pr-5 pl-2.5 text-[15px] font-medium transition hover:border-[#25D366]/50"
      }
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#25D366] text-white">
        <WhatsAppIcon className="size-4" />
      </span>
      {nombre}
    </a>
  );
}

/** Rótulo pequeño en versalitas + título grande, la misma pareja en cada sección. */
function Titulo({
  rotulo,
  titulo,
  bajada,
  alinear = "center",
}: {
  rotulo: string;
  titulo: string;
  bajada?: string;
  alinear?: "center" | "left";
}) {
  const centro = alinear === "center";
  return (
    <div className={centro ? "text-center" : "text-center sm:text-left"}>
      <p className="label-caps text-primary">{rotulo}</p>
      <h2 className="font-display mt-2 text-3xl sm:text-4xl lg:text-5xl">{titulo}</h2>
      {bajada ? (
        <p
          className={`text-muted-foreground mt-3 text-base text-balance lg:text-lg ${
            centro ? "mx-auto max-w-xl" : "max-w-xl"
          }`}
        >
          {bajada}
        </p>
      ) : null}
    </div>
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
  const grupos = [...serviciosPorCategoria.values()];

  return (
    <div className="flex-1">
      {/* Hero: foto real del estudio, la marca, y las tres únicas salidas */}
      <section className="relative flex min-h-[640px] items-center overflow-hidden sm:min-h-[720px] lg:min-h-[85vh]">
        <Image
          src="/trabajos/estudio-ambiente.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

        <div className="relative z-10 mx-auto w-full max-w-md px-5 py-16 text-center text-white sm:max-w-xl lg:max-w-3xl lg:py-24">
          {/* La flor es cuadrada de origen; el logotipo completo es 2.5:1 y
              en un círculo se deformaba. */}
          <Image
            src="/marca/flor-ariale.png"
            alt=""
            width={128}
            height={128}
            className="mx-auto size-14 sm:size-16 lg:size-20"
          />
          <h1 className="font-display mt-5 text-5xl sm:text-6xl lg:text-7xl">
            {settings.businessName}
          </h1>
          <p className="mt-4 text-lg text-balance text-white/85 sm:text-xl lg:text-2xl">
            {settings.tagline}
          </p>

          <div className="mx-auto mt-10 max-w-sm sm:max-w-md">
            <Link
              href="/reservar"
              className="brand-gradient text-primary-foreground inline-flex w-full items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-base font-semibold shadow-lg transition hover:brightness-105 active:scale-[0.99] sm:text-lg"
            >
              <CalendarPlus className="size-5" />
              Agendar mi cita
            </Link>

            <p className="mt-7 text-[0.7rem] font-semibold tracking-[0.2em] text-white/70 uppercase">
              O escríbele directo
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              {waEspecialistas.map((e) => (
                <WaPill key={e.nombre} href={e.href} nombre={e.nombre} tono="oscuro" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Por qué agendar con nosotras */}
      <section className="px-5 py-14 sm:py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-3 lg:gap-12">
          {RAZONES.map((r, i) => {
            const Icono = r.icono;
            return (
              <Reveal key={r.titulo} delay={i * 90}>
                <div className="text-center sm:text-left">
                  <span className="bg-primary/12 text-primary inline-flex size-12 items-center justify-center rounded-2xl lg:size-14">
                    <Icono className="size-5 lg:size-6" />
                  </span>
                  <p className="font-display mt-4 text-xl lg:text-2xl">{r.titulo}</p>
                  <p className="text-muted-foreground mt-2 text-base text-balance">{r.texto}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Qué hacemos, con foto real por categoría */}
      {categories.length > 0 ? (
        <section className="px-5 pb-14 sm:pb-20 lg:pb-24">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <Titulo
                rotulo="Qué hacemos"
                titulo="Uñas, pies y cejas"
                bajada="Tres áreas, cada una con su especialista y su propio catálogo."
              />
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:gap-6">
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
                        className="object-cover transition duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-6 lg:p-8">
                        <span className="mb-3 inline-flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur">
                          <Icono className="size-4" />
                        </span>
                        <p className="font-display text-2xl text-white sm:text-3xl lg:text-4xl">
                          {categoria.name}
                        </p>
                        <p className="mt-1.5 text-sm text-white/85 lg:text-base">
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
      {grupos.length > 0 ? (
        <section className="bg-card/60 border-y px-5 py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <Titulo
                rotulo="Servicios y precios"
                titulo="Lo que hacemos y cuánto cuesta"
                bajada="Los mismos precios que verás al agendar, sin sorpresas."
              />
            </Reveal>

            <div className="mt-10 grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {grupos.map((grupo, i) => {
                const Icono = ICONO_POR_TIPO[grupo.kind];
                return (
                  <Reveal key={grupo.nombre} delay={i * 100}>
                    <div className="surface p-6 lg:p-7">
                      <div className="flex items-center gap-3">
                        <span className="bg-primary/12 text-primary grid size-10 place-items-center rounded-full">
                          <Icono className="size-4.5" />
                        </span>
                        <h3 className="font-display text-2xl">{grupo.nombre}</h3>
                      </div>
                      <ul className="mt-5 space-y-3.5">
                        {grupo.items.map((s) => (
                          <li key={s.id} className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block truncate text-[15px] font-medium">
                                {s.name}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {fmtDuration(s.durationMin)}
                              </span>
                            </span>
                            <span className="border-border/70 mx-1 hidden flex-1 border-b border-dotted sm:block" />
                            <span className="font-numeric shrink-0 text-[15px]">
                              {formatUsd(s.priceCents)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* Galería: el trabajo real, no un catálogo de stock */}
      <section className="px-5 py-14 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <Titulo
              rotulo="Nuestro trabajo"
              titulo="Lo que ya hicimos"
              bajada="Cada diseño sale distinto según la clienta. Esto no es un catálogo: son manos reales."
            />
          </Reveal>
          {/* Nueve fotos: en tres columnas cierran parejas, en cuatro queda una huérfana. */}
          <div className="mt-10 columns-2 gap-3 sm:columns-3 sm:gap-4 lg:gap-5">
            {GALERIA.map((foto, i) => (
              <Reveal key={foto.src} delay={(i % 4) * 80}>
                <div className="surface-sm mb-3 overflow-hidden p-0 sm:mb-4 lg:mb-5">
                  <Image
                    src={foto.src}
                    alt={foto.alt}
                    width={480}
                    height={640}
                    sizes="(min-width: 640px) 33vw, 50vw"
                    className="w-full transition duration-700 hover:scale-105"
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* El equipo: dos personas, no una franquicia */}
      <section className="bg-card/60 border-y px-5 py-14 sm:py-20 lg:py-24">
        <Reveal>
          <div className="mx-auto grid max-w-6xl items-center gap-10 sm:grid-cols-[minmax(0,320px)_1fr] lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-16">
            <div className="mx-auto w-56 overflow-hidden rounded-3xl shadow-lg sm:w-full">
              <Image
                src="/equipo/alejandra-arianny.webp"
                alt={`Alejandra y Arianny, ${settings.businessName}`}
                width={560}
                height={746}
                sizes="(min-width: 1024px) 420px, (min-width: 640px) 320px, 224px"
                className="w-full"
              />
            </div>
            <div>
              <Titulo
                rotulo="Quiénes somos"
                titulo="Alejandra & Arianny"
                alinear="left"
              />
              <p className="text-muted-foreground mt-5 text-center text-base text-balance sm:text-left lg:text-lg">
                Un sueño hecho realidad con amor, fe y mucho profesionalismo. Alejandra lleva
                las uñas: arte y cuidado para tus manos. Arianny lleva las cejas: diseñando la
                mirada que siempre soñaste. Cada quien en lo suyo, para que a ti te toque lo
                mejor de las dos.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3 sm:justify-start">
                {waEspecialistas.map((e) => (
                  <WaPill key={e.nombre} href={e.href} nombre={e.nombre} />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Cierre: agendar de nuevo, las dos vías por WhatsApp, y dónde encontrarnos */}
      <section className="px-5 pt-14 pb-28 sm:py-20 lg:py-24">
        <Reveal>
          <div className="surface mx-auto max-w-4xl p-7 sm:p-10 lg:p-12">
            <div className="grid gap-8 sm:grid-cols-[1.2fr_1fr] sm:gap-12">
              <div className="text-center sm:text-left">
                <h2 className="font-display text-3xl sm:text-4xl">¿Lista para tu cita?</h2>
                <p className="text-muted-foreground mt-2 text-base">
                  Agenda en línea o escríbele directo a quien necesitas.
                </p>
                <Link
                  href="/reservar"
                  className="brand-gradient text-primary-foreground mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-base font-semibold shadow-sm transition hover:brightness-105 active:scale-[0.99] sm:w-auto"
                >
                  <CalendarPlus className="size-5" />
                  Agendar mi cita
                </Link>
                <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
                  {waEspecialistas.map((e) => (
                    <WaPill key={e.nombre} href={e.href} nombre={e.nombre} />
                  ))}
                </div>
              </div>

              {(abiertos.length > 0 || settings.address) && (
                <div className="border-border/70 space-y-5 border-t pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-10">
                  {abiertos.length > 0 ? (
                    <div className="flex gap-3">
                      <Clock className="text-primary mt-0.5 size-5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">Horario</p>
                        <ul className="text-muted-foreground mt-1 space-y-0.5 text-sm">
                          {abiertos.map((h) => (
                            <li key={h.dayOfWeek} className="flex justify-between gap-4">
                              <span>{DAY_SHORT[h.dayOfWeek]}</span>
                              <span className="font-numeric">
                                {h.openTime}–{h.closeTime}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  {settings.address ? (
                    <div className="flex gap-3">
                      <MapPin className="text-primary mt-0.5 size-5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">Dónde estamos</p>
                        <p className="text-muted-foreground mt-1 text-sm">{settings.address}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </Reveal>

        <p className="text-muted-foreground mt-10 text-center text-sm">
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

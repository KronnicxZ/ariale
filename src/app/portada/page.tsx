import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, CalendarPlus, Clock, MapPin, Sparkles, UserCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSettings, getWorkingHours } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";
import { DAY_SHORT, fmtDuration } from "@/lib/date";
import { formatUsd } from "@/lib/money";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Reveal } from "./reveal";
import { CintaFotos, CintaPalabras } from "./cinta";
import { Galeria, type Foto } from "./galeria";
import { Servicios, type AreaServicio } from "./servicios";
import type { CategoryKind } from "@/generated/prisma/client";

export const metadata = { title: "Inicio" };
// Horario, precios y servicios salen del panel: si cambian ahí, se tienen
// que ver aquí sin esperar a un redespliegue.
export const dynamic = "force-dynamic";

const DESCRIPCION_POR_TIPO: Record<CategoryKind, string> = {
  MANICURE: "Esmaltado, sistemas y diseño. Arte y cuidado para tus manos, con la forma y el largo que tú quieras.",
  PEDICURE: "Pedicura spa y semipermanente, sin prisa, para que los pies queden tan cuidados como las manos.",
  DEPILATION: "Cejas diseñadas según tu rostro, y cera donde la necesites. Diseñando la mirada que siempre soñaste.",
  OTHER: "Consulta el detalle al agendar.",
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

const GALERIA: Foto[] = [
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
    texto: "Alejandra lleva uñas; Arianny, cejas y depilación. Nada de generalistas.",
  },
  {
    icono: Sparkles,
    titulo: "Un trabajo, no una plantilla",
    texto: "Cada diseño se piensa para la clienta que lo lleva puesto.",
  },
];

/** Botón de WhatsApp con el glifo real, legible sobre claro y sobre oscuro. */
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
          ? "inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 py-2.5 pr-5 pl-2.5 text-[15px] font-medium text-white backdrop-blur transition hover:bg-white/20"
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

function BotonAgendar({ ancho = false }: { ancho?: boolean }) {
  return (
    <Link
      href="/reservar"
      className={`brand-gradient text-primary-foreground inline-flex items-center justify-center gap-2.5 rounded-full px-8 py-4 text-base font-semibold shadow-lg transition hover:brightness-105 active:scale-[0.99] ${
        ancho ? "w-full sm:w-auto" : ""
      }`}
    >
      <CalendarPlus className="size-5" />
      Agendar mi cita
    </Link>
  );
}

/** Rótulo en versalitas doradas + título serif grande. */
function Titulo({
  rotulo,
  titulo,
  bajada,
  alinear = "center",
  oscuro = false,
}: {
  rotulo: string;
  titulo: string;
  bajada?: string;
  alinear?: "center" | "left";
  oscuro?: boolean;
}) {
  const centro = alinear === "center";
  return (
    <div className={centro ? "text-center" : "text-center sm:text-left"}>
      <p className="label-caps oro">{rotulo}</p>
      <h2 className="font-display mt-3 text-4xl text-balance sm:text-5xl lg:text-6xl">{titulo}</h2>
      {bajada ? (
        <p
          className={`mt-4 text-base text-balance lg:text-lg ${
            oscuro ? "text-white/65" : "text-muted-foreground"
          } ${centro ? "mx-auto max-w-2xl" : "max-w-2xl"}`}
        >
          {bajada}
        </p>
      ) : null}
    </div>
  );
}

export default async function PortadaPage() {
  const [settings, workingHours, servicios] = await Promise.all([
    getSettings(),
    getWorkingHours(),
    prisma.service.findMany({
      where: { active: true, category: { active: true } },
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        name: true,
        priceCents: true,
        durationMin: true,
        category: { select: { id: true, name: true, kind: true, order: true } },
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

  // Un bloque por categoría, con sus servicios y precios reales.
  const porCategoria = new Map<string, AreaServicio>();
  for (const s of servicios) {
    const area = porCategoria.get(s.category.id) ?? {
      id: s.category.id,
      nombre: s.category.name,
      descripcion: DESCRIPCION_POR_TIPO[s.category.kind],
      foto: FOTO_POR_TIPO[s.category.kind],
      servicios: [],
    };
    area.servicios.push({
      id: s.id,
      nombre: s.name,
      duracion: fmtDuration(s.durationMin),
      precio: formatUsd(s.priceCents),
    });
    porCategoria.set(s.category.id, area);
  }
  const areas = [...porCategoria.values()];

  // La cinta mezcla las áreas con los servicios que más las definen, para
  // que no sean tres palabras dando vueltas.
  const palabrasCinta = [
    ...areas.map((a) => a.nombre),
    ...servicios.slice(0, 6).map((s) => s.name),
  ].filter((p, i, todas) => todas.indexOf(p) === i);

  return (
    <div className="flex-1 overflow-x-hidden">
      {/* ------------------------------------------------------------------
          Hero: la foto del estudio respirando, la marca y las tres salidas
          ------------------------------------------------------------------ */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/trabajos/estudio-ambiente.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="respira object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85" />

        <div className="relative z-10 mx-auto w-full max-w-4xl px-5 py-20 text-center text-white">
          <Image
            src="/marca/flor-ariale.svg"
            alt=""
            width={96}
            height={96}
            className="mx-auto size-16 sm:size-20 lg:size-24"
            priority
          />
          <h1 className="font-display mt-6 text-5xl leading-[1.05] text-balance sm:text-7xl lg:text-8xl">
            {settings.businessName}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-balance text-white/75 sm:text-xl">
            {settings.tagline}
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <BotonAgendar ancho />
            <div className="flex items-center gap-3">
              {waEspecialistas.map((e) => (
                <WaPill key={e.nombre} href={e.href} nombre={e.nombre} tono="oscuro" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <CintaPalabras palabras={palabrasCinta} />

      {/* ------------------------------------------------------------------
          Por qué agendar con ellas
          ------------------------------------------------------------------ */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-3 lg:gap-14">
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

      {/* ------------------------------------------------------------------
          Servicios contados al bajar, con sus precios reales
          ------------------------------------------------------------------ */}
      {areas.length > 0 ? (
        <section className="px-5 pb-16 sm:pb-24">
          <Reveal>
            <div className="mx-auto max-w-7xl pb-12 lg:pb-16">
              <Titulo
                rotulo="Qué hacemos"
                titulo="Uñas, pies y cejas"
                bajada="Tres áreas, cada una con su especialista. Estos son los mismos precios que verás al agendar."
              />
            </div>
          </Reveal>
          <Servicios areas={areas} />
        </section>
      ) : null}

      <CintaFotos fotos={GALERIA} />

      {/* ------------------------------------------------------------------
          Galería sobre negro: las fotos mandan
          ------------------------------------------------------------------ */}
      <section className="noche px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <Titulo
              rotulo="Nuestro trabajo"
              titulo="Lo que ya hicimos"
              bajada="Cada diseño sale distinto según la clienta. Esto no es un catálogo: son manos reales. Tócalas para verlas grandes."
              oscuro
            />
          </Reveal>
          <div className="mt-12">
            <Galeria fotos={GALERIA} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          El equipo: dos personas, no una franquicia
          ------------------------------------------------------------------ */}
      <section className="px-5 py-16 sm:py-24">
        <Reveal>
          <div className="mx-auto grid max-w-6xl items-center gap-10 sm:grid-cols-[minmax(0,320px)_1fr] lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-16">
            <div className="relative mx-auto aspect-[3/4] w-60 overflow-hidden rounded-3xl shadow-xl sm:w-full">
              <Image
                src="/equipo/alejandra-arianny.webp"
                alt={`Alejandra y Arianny, ${settings.businessName}`}
                fill
                sizes="(min-width: 1024px) 440px, (min-width: 640px) 320px, 240px"
                className="object-cover"
              />
            </div>
            <div>
              <Titulo rotulo="Quiénes somos" titulo="Alejandra & Arianny" alinear="left" />
              <p className="text-muted-foreground mt-5 text-center text-base text-balance sm:text-left lg:text-lg">
                Un sueño hecho realidad con amor, fe y mucho profesionalismo. Alejandra lleva las
                uñas: arte y cuidado para tus manos. Arianny lleva las cejas: diseñando la mirada
                que siempre soñaste. Cada quien en lo suyo, para que a ti te toque lo mejor de las
                dos.
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

      {/* ------------------------------------------------------------------
          Cierre: agendar, escribir, y dónde encontrarlas
          ------------------------------------------------------------------ */}
      <section className="noche filo-oro border-t px-5 py-16 pb-28 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="grid gap-12 sm:grid-cols-[1.15fr_1fr] sm:gap-16">
              <div className="text-center sm:text-left">
                <Titulo rotulo="Tu turno" titulo="¿Lista para tu cita?" alinear="left" />
                <p className="mt-4 text-base text-white/65">
                  Agenda en línea en un minuto, o escríbele directo a quien necesitas.
                </p>
                <div className="mt-8">
                  <BotonAgendar ancho />
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
                  {waEspecialistas.map((e) => (
                    <WaPill key={e.nombre} href={e.href} nombre={e.nombre} tono="oscuro" />
                  ))}
                </div>
              </div>

              {(abiertos.length > 0 || settings.address) && (
                <div className="filo-oro space-y-7 border-t pt-8 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-12">
                  {abiertos.length > 0 ? (
                    <div className="flex gap-3.5">
                      <Clock className="text-primary mt-0.5 size-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">Horario</p>
                        <ul className="mt-2 space-y-1 text-sm text-white/65">
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
                    <div className="flex gap-3.5">
                      <MapPin className="text-primary mt-0.5 size-5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-white">Dónde estamos</p>
                        <p className="mt-1 text-sm text-white/65">{settings.address}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </Reveal>

          <p className="mt-16 text-center text-sm text-white/40">
            {settings.businessName}
            {settings.instagram ? ` · @${settings.instagram}` : ""}
          </p>
        </div>
      </section>

      {/* Barra fija en el teléfono, para no tener que volver a subir. */}
      <div className="bg-card/95 safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
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

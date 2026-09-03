import Image from "next/image";
import Link from "next/link";
import {
  AtSign,
  CalendarPlus,
  Clock,
  Droplets,
  Footprints,
  LogIn,
  MapPin,
  MessageCircle,
  Sparkles,
} from "lucide-react";
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

  const mensajeWa = `Hola, quisiera saber más sobre ${settings.businessName}.`;

  return (
    <div className="flex-1">
      {/* Hero */}
      <section className="soft-blush px-5 pt-14 pb-12">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <Image
            src="/marca/logo-ariale.png"
            alt={settings.businessName}
            width={88}
            height={88}
            className="rounded-full"
            priority
          />
          <h1 className="font-display mt-5 text-4xl">{settings.businessName}</h1>
          <p className="text-muted-foreground mt-3 text-base text-balance">
            {settings.tagline}
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/reservar"
              className="brand-gradient text-primary-foreground inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-semibold shadow-sm transition active:scale-[0.99]"
            >
              <CalendarPlus className="size-5" />
              Reservar mi cita
            </Link>
            <Link
              href="/login"
              className="surface text-foreground inline-flex items-center justify-center gap-2 px-6 py-3.5 font-semibold transition active:scale-[0.99]"
            >
              <LogIn className="size-4" />
              Entrar al panel
            </Link>
          </div>
        </div>
      </section>

      {/* Qué hacemos */}
      {categories.length > 0 ? (
        <section className="px-5 py-10">
          <div className="mx-auto max-w-md">
            <h2 className="label-caps text-muted-foreground text-center">Qué hacemos</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {categories.map((categoria) => {
                const Icono = ICONO_POR_TIPO[categoria.kind];
                return (
                  <div key={categoria.id} className="surface flex flex-col gap-2 p-4">
                    <span className="bg-primary/12 text-primary grid size-10 place-items-center rounded-xl">
                      <Icono className="size-5" />
                    </span>
                    <span className="font-semibold">{categoria.name}</span>
                    <span className="text-muted-foreground text-sm">
                      {DESCRIPCION_POR_TIPO[categoria.kind]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* Horario, ubicación y contacto */}
      <section className="px-5 pb-16">
        <div className="surface mx-auto max-w-md space-y-4 p-6">
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

          <div className="flex flex-wrap gap-2.5 pt-1">
            {settings.whatsapp ? (
              <a
                href={waLink(settings.whatsapp, mensajeWa, settings.countryCode)}
                target="_blank"
                rel="noreferrer"
                className="bg-primary/12 text-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:opacity-80"
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
            ) : null}
            {settings.instagram ? (
              <a
                href={`https://instagram.com/${settings.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="bg-muted text-foreground inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:opacity-80"
              >
                <AtSign className="size-4" />
                {settings.instagram}
              </a>
            ) : null}
          </div>
        </div>

        <p className="text-muted-foreground mt-8 text-center text-xs">
          {settings.businessName}
        </p>
      </section>
    </div>
  );
}

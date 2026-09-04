import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { getSettings } from "@/lib/settings";
import { getCurrentClient } from "@/lib/auth";
import { clientLogoutAction } from "@/actions/auth";
import { getWorkingHours } from "@/lib/settings";
import { DAY_SHORT, hora12 } from "@/lib/date";

export default async function ReservarLayout({ children }: LayoutProps<"/reservar">) {
  const [settings, client, hours] = await Promise.all([
    getSettings(),
    getCurrentClient(),
    getWorkingHours(),
  ]);

  const open = hours.filter((h) => h.enabled);
  // En 12 h, como en la portada y como lo dice cualquiera aquí.
  const scheduleLabel =
    open.length === 0
      ? "Consúltanos el horario"
      : `${DAY_SHORT[open[0].dayOfWeek]} a ${DAY_SHORT[open[open.length - 1].dayOfWeek]} · ${hora12(open[0].openTime)} – ${hora12(open[0].closeTime)}`;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* En el teléfono esto es toda la pantalla: se siente como la app.
          A partir de lg, se vuelve un panel al lado, no una tarjeta perdida
          en medio de una página vacía. */}
      {/* Pegado y del alto de la ventana: si crece la lista de servicios, el
          panel no se estira detrás con el lema fuera de la pantalla. */}
      <div className="relative hidden shrink-0 overflow-hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-[42%] xl:w-[38%]">
        {/* El recorte va hacia la derecha: en una columna tan alta y estrecha,
            el centro de la foto es la cortina negra y el estudio se queda
            fuera de cuadro. */}
        <Image
          src="/trabajos/estudio-ambiente.jpg"
          alt=""
          fill
          priority
          sizes="42vw"
          className="object-cover object-[78%_center]"
        />
        {/* Dos capas: una general que baja el brillo de la foto y otra que
            oscurece de verdad los dos extremos, que es donde va el texto. */}
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-transparent to-black/95" />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white xl:p-14">
          {/* El logotipo entero, sin meterlo en un círculo: es de 1000×400 y
              deformarlo a un cuadrado lo dejaba estirado. */}
          <Link href="https://www.ariale.space/" className="inline-block">
            <Image
              src="/marca/logo-ariale.png"
              alt={settings.businessName}
              width={1000}
              height={400}
              sizes="320px"
              className="h-auto w-60 xl:w-72"
            />
          </Link>

          <div className="max-w-sm">
            {/* Sin `text-balance`: aquí el ancho es fijo y estrecho, y lo que
                hacía era dejar una última línea de una sola palabra. */}
            <p className="font-display text-3xl leading-[1.15] xl:text-4xl">{settings.tagline}</p>
            <span className="bg-primary/70 mt-6 block h-px w-14" />
            <p className="mt-5 text-sm text-white/80">{client ? "Tu espacio" : scheduleLabel}</p>
            {settings.address ? (
              <p className="mt-1 text-sm text-white/55">{settings.address}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 lg:hidden">
          <Link href="/reservar" className="flex min-w-0 flex-1 items-center gap-3">
            <BrandMark logoUrl={settings.logoUrl} name={settings.businessName} height={30} />
            <span className="text-muted-foreground min-w-0 truncate text-xs">
              {client ? "Tu espacio" : scheduleLabel}
            </span>
          </Link>

          {client ? (
            <form action={clientLogoutAction}>
              <button type="submit" className="text-muted-foreground shrink-0 text-sm">
                Salir
              </button>
            </form>
          ) : null}
        </header>

        {client ? (
          <div className="hidden justify-end px-6 pt-5 lg:flex">
            <form action={clientLogoutAction}>
              <button type="submit" className="text-muted-foreground text-sm hover:underline">
                Salir de mi cuenta
              </button>
            </form>
          </div>
        ) : null}

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

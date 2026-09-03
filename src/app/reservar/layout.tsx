import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { getSettings } from "@/lib/settings";
import { getCurrentClient } from "@/lib/auth";
import { clientLogoutAction } from "@/actions/auth";
import { getWorkingHours } from "@/lib/settings";
import { DAY_SHORT } from "@/lib/date";

export default async function ReservarLayout({ children }: LayoutProps<"/reservar">) {
  const [settings, client, hours] = await Promise.all([
    getSettings(),
    getCurrentClient(),
    getWorkingHours(),
  ]);

  const open = hours.filter((h) => h.enabled);
  const scheduleLabel =
    open.length === 0
      ? "Consúltanos el horario"
      : `${DAY_SHORT[open[0].dayOfWeek]} a ${DAY_SHORT[open[open.length - 1].dayOfWeek]} · ${open[0].openTime} – ${open[0].closeTime}`;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* En el teléfono esto es toda la pantalla: se siente como la app.
          A partir de lg, se vuelve un panel al lado, no una tarjeta perdida
          en medio de una página vacía. */}
      <div className="relative hidden shrink-0 overflow-hidden lg:block lg:w-[42%] xl:w-[38%]">
        <Image
          src="/trabajos/estudio-ambiente.jpg"
          alt=""
          fill
          priority
          sizes="42vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white xl:p-14">
          <Link href="https://www.ariale.space/" className="inline-flex items-center gap-2.5">
            <Image
              src="/marca/logo-ariale.png"
              alt={settings.businessName}
              width={44}
              height={44}
              className="rounded-full"
            />
            <span className="font-display text-lg">{settings.businessName}</span>
          </Link>
          <div>
            <p className="font-display text-4xl xl:text-5xl">{settings.tagline}</p>
            <p className="mt-4 text-sm text-white/75">
              {client ? "Tu espacio" : scheduleLabel}
            </p>
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

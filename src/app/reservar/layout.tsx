import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
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
    <div className="flex min-h-dvh flex-col">
      <header className="bg-card sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3">
        <Link href="/reservar" className="flex min-w-0 flex-1 items-center gap-3">
          {settings.logoUrl ? (
            <Image
              src={settings.logoUrl}
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-full">
              <Sparkles className="size-5" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-semibold">{settings.businessName}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {client ? "Tu espacio" : scheduleLabel}
            </span>
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

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

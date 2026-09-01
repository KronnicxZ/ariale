"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, LogOut, Menu, UserRound } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn, initials } from "@/lib/utils";
import { MOBILE_NAV, NAV_GROUPS, activeItem } from "@/components/panel/nav-config";
import { BrandMark } from "@/components/brand-mark";
import { logoutAction } from "@/actions/auth";

type Props = {
  business: { name: string; logoUrl: string | null };
  user: { name: string; email: string };
  rate: { rate: number; stale: boolean };
};

/** Cabecera con menú lateral + barra inferior fija. Solo en móvil y tablet. */
export function MobileNav({ business, user, rate }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = activeItem(pathname);

  return (
    <>
      <header className="menu-gradient safe-top sticky top-0 z-30 flex items-center gap-2 px-3 py-3 text-white lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 transition active:bg-white/20">
            <Menu className="size-5" />
            <span className="sr-only">Abrir menú</span>
          </SheetTrigger>
          <SheetContent side="left" className="menu-gradient w-[17rem] border-none p-0 text-white">
            <SheetTitle className="sr-only">Menú</SheetTitle>

            <div className="flex items-center px-5 py-6">
              <BrandMark logoUrl={business.logoUrl} name={business.name} height={34} onDark />
            </div>

            <nav className="no-scrollbar h-[calc(100dvh-13rem)] space-y-5 overflow-y-auto px-3 pb-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1">
                  <p className="px-3 pb-1 text-[0.65rem] font-semibold tracking-widest text-white/40 uppercase">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const active = current?.href === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-white/75 active:bg-white/10",
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="safe-bottom space-y-2 border-t border-white/10 px-3 py-3">
              <Link
                href="/panel/modo-agenda"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium"
              >
                <CalendarClock className="size-4" />
                Modo agenda
              </Link>
              <div className="flex gap-1">
                <Link
                  href="/panel/perfil"
                  onClick={() => setOpen(false)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs text-white/70"
                >
                  <UserRound className="size-3.5" />
                  {user.name}
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs text-white/70"
                  >
                    <LogOut className="size-3.5" />
                    Salir
                  </button>
                </form>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{current?.label ?? business.name}</p>
          <p className="truncate text-[0.7rem] text-white/55">
            {rate.rate > 0 ? `1 USD = ${rate.rate.toFixed(2)} Bs.` : "Sin tasa BCV"}
          </p>
        </div>

        <Link
          href="/panel/perfil"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-semibold"
        >
          {initials(user.name)}
        </Link>
      </header>

      <nav className="bg-card/95 safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t backdrop-blur lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active = current?.href === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[0.68rem] font-medium transition",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className={cn("size-5", active && "stroke-[2.4]")} />
              {item.shortLabel ?? item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

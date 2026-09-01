"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, LogOut, Sparkles, UserRound } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { NAV_GROUPS } from "@/components/panel/nav-config";
import { logoutAction } from "@/actions/auth";

type Props = {
  business: { name: string; logoUrl: string | null };
  user: { name: string; email: string; role: string };
  rate: { rate: number; stale: boolean; source: string };
};

export function Sidebar({ business, user, rate }: Props) {
  const pathname = usePathname();

  return (
    <aside className="menu-gradient text-sidebar-foreground fixed inset-y-0 left-0 z-40 hidden w-64 flex-col lg:flex">
      <Link
        href="/panel"
        className="flex items-center gap-3 px-5 py-5 transition hover:opacity-90"
      >
        {business.logoUrl ? (
          <Image
            src={business.logoUrl}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-xl object-cover"
          />
        ) : (
          <span className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-xl">
            <Sparkles className="size-5" />
          </span>
        )}
        <span className="font-heading min-w-0 truncate text-lg font-semibold">
          {business.name}
        </span>
      </Link>

      <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-3 pb-1 text-[0.65rem] font-semibold tracking-widest text-white/40 uppercase">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/panel" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/10 px-3 py-3">
        <Link
          href="/panel/modo-agenda"
          className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
        >
          <CalendarClock className="size-4" />
          Modo agenda
        </Link>

        <div className="flex items-center gap-3 px-2 pt-1">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-semibold text-white">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-white/50">
              {rate.rate > 0 ? `1 USD = ${rate.rate.toFixed(2)} Bs.` : "Sin tasa"}
              {rate.stale ? " · desactualizada" : ""}
            </p>
          </div>
        </div>

        <div className="flex gap-1">
          <Link
            href="/panel/perfil"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <UserRound className="size-3.5" />
            Perfil
          </Link>
          <form action={logoutAction} className="flex-1">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-3.5" />
              Salir
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

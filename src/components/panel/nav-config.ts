import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  BellRing,
  CalendarDays,
  ChartNoAxesCombined,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  Receipt,
  Settings2,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  UserRoundCog,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Se muestra en la barra inferior del móvil. */
  mobile?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Día a día",
    items: [
      { href: "/panel", label: "Dashboard", icon: LayoutDashboard, mobile: true },
      { href: "/panel/agenda", label: "Agenda", icon: CalendarDays, mobile: true },
      { href: "/panel/clientes", label: "Clientas", icon: Users, mobile: true },
      { href: "/panel/recordatorios", label: "Recordatorios", icon: BellRing },
    ],
  },
  {
    label: "Dinero",
    items: [
      { href: "/panel/ventas", label: "Ventas", icon: Receipt, mobile: true },
      { href: "/panel/cobrar", label: "Cuentas por cobrar", icon: HandCoins },
      { href: "/panel/gastos", label: "Gastos", icon: Wallet },
      { href: "/panel/compras", label: "Compras", icon: ShoppingBag },
      { href: "/panel/pagar", label: "Cuentas por pagar", icon: CreditCard },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/panel/servicios", label: "Servicios", icon: Sparkles },
      { href: "/panel/bonos", label: "Bonos", icon: BadgePercent },
      { href: "/panel/especialistas", label: "Especialistas", icon: UserRoundCog },
      { href: "/panel/proveedores", label: "Proveedores", icon: Truck },
    ],
  },
  {
    label: "Análisis",
    items: [
      { href: "/panel/reportes", label: "Reportes", icon: ChartNoAxesCombined },
      { href: "/panel/negocio", label: "Mi negocio", icon: Settings2 },
    ],
  },
];

export const MOBILE_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.mobile);

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** El item de navegación que corresponde a una ruta, eligiendo el más específico. */
export function activeItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getRate } from "@/lib/rate";
import { Sidebar } from "@/components/panel/sidebar";
import { MobileNav } from "@/components/panel/mobile-nav";

// El panel pide sesión, pero además se le dice al buscador que no entre: si
// una ruta se deja abierta por error, que no acabe indexada encima.
export const metadata = { robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [settings, rate] = await Promise.all([getSettings(), getRate()]);

  const business = { name: settings.businessName, logoUrl: settings.logoUrl };
  const currentUser = { name: user.name, email: user.email, role: user.role };

  return (
    <div className="min-h-dvh">
      <Sidebar business={business} user={currentUser} rate={rate} />
      <MobileNav business={business} user={currentUser} rate={rate} />

      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-7xl px-4 pt-4 pb-24 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

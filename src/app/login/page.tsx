import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/panel");
  const settings = await getSettings();

  return (
    <main className="soft-blush flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <BrandMark logoUrl={settings.logoUrl} name={settings.businessName} height={72} />
          <p className="text-muted-foreground max-w-xs text-sm">{settings.tagline}</p>
        </div>

        <div className="bg-card rounded-3xl p-7 shadow-[var(--shadow-lift)]">
          <div className="mb-6 space-y-1.5">
            <h1 className="font-display text-2xl">Entra a tu panel</h1>
            <p className="text-muted-foreground text-sm">
              Aquí ves las ventas, la agenda y las cuentas del estudio.
            </p>
          </div>
          <LoginForm />
        </div>

        <p className="text-muted-foreground mt-8 text-center text-xs">
          ¿Eres clienta?{" "}
          <a href="/reservar" className="text-primary font-medium hover:underline">
            Agenda tu cita aquí
          </a>
        </p>
      </div>
    </main>
  );
}

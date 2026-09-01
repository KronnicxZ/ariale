import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/panel");
  const settings = await getSettings();

  return (
    <main className="soft-blush flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="brand-gradient text-primary-foreground grid size-14 place-items-center rounded-2xl shadow-lg">
            <Sparkles className="size-7" />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-semibold">{settings.businessName}</h1>
            <p className="text-muted-foreground text-sm">{settings.tagline}</p>
          </div>
        </div>

        <div className="bg-card rounded-3xl border p-6 shadow-sm">
          <div className="mb-5 space-y-1">
            <h2 className="text-lg font-semibold">Entra a tu panel</h2>
            <p className="text-muted-foreground text-sm">
              Aquí ves las ventas, la agenda y las cuentas del salón.
            </p>
          </div>
          <LoginForm />
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          ¿Eres clienta?{" "}
          <a href="/reservar" className="text-primary font-medium hover:underline">
            Agenda tu cita aquí
          </a>
        </p>
      </div>
    </main>
  );
}

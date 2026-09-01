import Link from "next/link";
import { ArrowLeft, KeyRound, Link2, Users } from "lucide-react";
import { PageHeader } from "@/components/panel/page-header";
import { CopyField } from "@/components/panel/copy-field";
import { AutoConfirmToggle } from "./auto-confirm-toggle";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { bookingLinkMessage } from "@/lib/whatsapp";
import { initials } from "@/lib/utils";

export const metadata = { title: "Enlaces de reserva" };

export default async function BookingLinksPage() {
  const [settings, specialists] = await Promise.all([
    getSettings(),
    prisma.specialist.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, pin: true, color: true },
    }),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const publicLink = `${baseUrl}/reservar`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/panel/agenda"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition"
      >
        <ArrowLeft className="size-4" />
        Volver a la agenda
      </Link>

      <PageHeader
        title="Enlaces de reserva"
        description="Comparte estos enlaces por WhatsApp o ponlos en tu Instagram."
      />

      <section className="bg-card rounded-2xl border p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Users className="text-muted-foreground size-4" />
          Para tus clientas
        </h2>
        <p className="text-muted-foreground mt-1 mb-4 text-sm">
          Entran con su teléfono, eligen servicio y hora, y ven su historial. No necesitan
          instalar nada.
        </p>
        <CopyField
          value={publicLink}
          shareMessage={bookingLinkMessage(publicLink, settings.businessName)}
        />
      </section>

      <section className="bg-card rounded-2xl border p-5">
        <AutoConfirmToggle enabled={settings.autoConfirm} />
      </section>

      <section className="bg-card rounded-2xl border p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Link2 className="text-muted-foreground size-4" />
          Para tu equipo
        </h2>
        <p className="text-muted-foreground mt-1 mb-4 text-sm">
          Cada especialista abre su enlace, pone su clave de 4 dígitos y agenda desde el celular.
          Estos enlaces no dan acceso al panel ni a las ventas.
        </p>

        <ul className="space-y-4">
          {specialists.map((specialist) => (
            <li key={specialist.id} className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                  style={{ background: specialist.color }}
                >
                  {initials(specialist.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {specialist.name}
                </span>
                <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                  <KeyRound className="size-3.5" />
                  <strong className="tabular-nums">{specialist.pin}</strong>
                </span>
              </div>
              <CopyField value={`${baseUrl}/agenda/${specialist.slug}`} />
            </li>
          ))}
        </ul>

        {specialists.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Todavía no hay especialistas activas.{" "}
            <Link href="/panel/especialistas" className="text-primary hover:underline">
              Registra la primera
            </Link>
            .
          </p>
        ) : null}
      </section>
    </div>
  );
}

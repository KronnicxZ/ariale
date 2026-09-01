import { CalendarDays, KeyRound, UsersRound } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { StatusBadge } from "@/components/panel/status-badge";
import { CopyField } from "@/components/panel/copy-field";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { formatPhone, initials } from "@/lib/utils";
import { toggleSpecialistActiveAction } from "@/actions/catalog";
import { SpecialistDialog } from "./specialist-dialog";
import { cn } from "@/lib/utils";

export const metadata = { title: "Especialistas" };

export default async function SpecialistsPage() {
  const [specialists, services, settings] = await Promise.all([
    prisma.specialist.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        skills: { select: { serviceId: true } },
        appointments: {
          where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
          select: { startAt: true, status: true },
        },
        sales: {
          where: { status: { not: "CANCELLED" } },
          select: { totalCents: true },
        },
      },
    }),
    prisma.service.findMany({
      where: { active: true },
      orderBy: [{ category: { order: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
    getSettings(),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const now = new Date();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Especialistas"
        description="Quién atiende y con qué clave entra a su agenda"
        actions={<SpecialistDialog services={services} />}
      />

      {specialists.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-8" />}
          title="No hay especialistas"
          description="Registra a quien atiende para poder repartir la agenda."
          action={<SpecialistDialog services={services} />}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {specialists.map((specialist) => {
            const upcoming = specialist.appointments.filter((a) => a.startAt >= now).length;
            const attended = specialist.appointments.filter((a) => a.status === "ATTENDED").length;
            const revenueCents = specialist.sales.reduce((sum, s) => sum + s.totalCents, 0);
            const link = `${baseUrl}/agenda/${specialist.slug}`;

            return (
              <article
                key={specialist.id}
                className={cn(
                  "surface space-y-3 p-4",
                  !specialist.active && "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="grid size-12 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
                    style={{ background: specialist.color }}
                  >
                    {initials(specialist.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{specialist.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {specialist.phone
                        ? formatPhone(specialist.phone, settings.countryCode)
                        : "Sin teléfono"}
                      {" · "}
                      {specialist.skills.length > 0
                        ? `${specialist.skills.length} servicios`
                        : "Todos los servicios"}
                    </p>
                  </div>
                  {!specialist.active ? <StatusBadge>Inactiva</StatusBadge> : null}
                </div>

                <div className="grid grid-cols-3 gap-2 border-y py-2.5 text-center">
                  <div>
                    <p className="text-muted-foreground text-[0.65rem] uppercase">Atendidas</p>
                    <p className="text-sm font-semibold">{attended}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[0.65rem] uppercase">Próximas</p>
                    <p className="text-sm font-semibold">{upcoming}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[0.65rem] uppercase">Facturado</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatUsd(revenueCents, true)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <CalendarDays className="text-muted-foreground size-3.5" />
                    <span className="text-muted-foreground">Su enlace de agenda</span>
                  </div>
                  <CopyField value={link} />
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <KeyRound className="size-3.5" />
                    Clave: <strong className="tabular-nums">{specialist.pin}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-1 border-t pt-2">
                  <SpecialistDialog specialist={specialist} services={services} />
                  <form action={toggleSpecialistActiveAction}>
                    <input type="hidden" name="id" value={specialist.id} />
                    <button
                      type="submit"
                      className="text-muted-foreground hover:text-foreground px-2 text-xs transition"
                    >
                      {specialist.active ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

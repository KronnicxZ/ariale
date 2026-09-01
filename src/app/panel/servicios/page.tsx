import { Clock, ShieldAlert, Sparkles, Timer } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { StatusBadge } from "@/components/panel/status-badge";
import { prisma } from "@/lib/db";
import { fmtDuration } from "@/lib/date";
import { formatBs, formatUsd } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { toggleServiceActiveAction, deleteServiceAction } from "@/actions/catalog";
import { ServiceDialog } from "./service-dialog";
import { CategoryDialog } from "./category-dialog";
import { cn } from "@/lib/utils";

export const metadata = { title: "Servicios" };

const METHOD_LABELS: Record<string, string> = {
  WAX: "Cera",
  SUGAR: "Azúcar",
  LASER: "Láser",
  THREAD: "Hilo",
  RAZOR: "Cuchilla",
};

export default async function ServicesPage() {
  const [categories, rateInfo] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      include: {
        services: { orderBy: [{ order: "asc" }, { name: "asc" }] },
      },
    }),
    getRate(),
  ]);

  const allServices = categories.flatMap((c) => c.services);
  const activeCount = allServices.filter((s) => s.active).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Servicios"
        description="El catálogo del estudio y sus precios"
        actions={
          <>
            <ServiceDialog
              categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
            />
            <CategoryDialog />
          </>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        <div className="surface-sm px-3 py-2.5">
          <p className="text-muted-foreground text-[0.7rem] uppercase">Servicios</p>
          <p className="font-numeric text-xl font-semibold">{allServices.length}</p>
        </div>
        <div className="surface-sm px-3 py-2.5">
          <p className="text-muted-foreground text-[0.7rem] uppercase">Activos</p>
          <p className="font-numeric text-xl font-semibold">{activeCount}</p>
        </div>
        <div className="surface-sm px-3 py-2.5">
          <p className="text-muted-foreground text-[0.7rem] uppercase">Categorías</p>
          <p className="font-numeric text-xl font-semibold">{categories.length}</p>
        </div>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-8" />}
          title="Todavía no hay catálogo"
          description="Crea una categoría y agrega tus servicios con precio y duración."
          action={<CategoryDialog />}
        />
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
            <section key={category.id} className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-semibold">
                  <span className="size-3 rounded-full" style={{ background: category.color }} />
                  {category.name}
                  <span className="text-muted-foreground text-sm font-normal">
                    ({category.services.length})
                  </span>
                </h2>
                <div className="flex gap-1">
                  <CategoryDialog category={category} />
                  <ServiceDialog
                    categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
                    defaultCategoryId={category.id}
                  />
                </div>
              </div>

              {category.services.length === 0 ? (
                <p className="text-muted-foreground border-border/70 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                  Sin servicios en esta categoría.
                </p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {category.services.map((service) => (
                    <article
                      key={service.id}
                      className={cn(
                        "surface flex flex-col gap-2 p-3.5",
                        !service.active && "opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{service.name}</p>
                          {service.description ? (
                            <p className="text-muted-foreground line-clamp-2 text-xs">
                              {service.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold tabular-nums">
                            {formatUsd(service.priceCents)}
                          </p>
                          {rateInfo.rate ? (
                            <p className="text-muted-foreground text-[0.7rem] tabular-nums">
                              {formatBs(service.priceCents, rateInfo.rate)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" />
                          {fmtDuration(service.durationMin)}
                        </span>
                        {service.bodyZone ? <span>{service.bodyZone}</span> : null}
                        {service.method !== "NONE" ? (
                          <span>{METHOD_LABELS[service.method]}</span>
                        ) : null}
                        {service.sessionIntervalDays ? (
                          <span className="inline-flex items-center gap-1">
                            <Timer className="size-3" />
                            cada {service.sessionIntervalDays} d
                          </span>
                        ) : null}
                        {service.requiresPatchTest ? (
                          <span className="text-warning inline-flex items-center gap-1">
                            <ShieldAlert className="size-3" />
                            prueba previa
                          </span>
                        ) : null}
                      </div>

                      {!service.active ? <StatusBadge>Inactivo</StatusBadge> : null}

                      <div className="mt-auto flex items-center gap-1 border-t pt-2">
                        <ServiceDialog
                          service={service}
                          categories={categories.map((c) => ({
                            id: c.id,
                            name: c.name,
                            kind: c.kind,
                          }))}
                        />
                        <form action={toggleServiceActiveAction}>
                          <input type="hidden" name="id" value={service.id} />
                          <button
                            type="submit"
                            className="text-muted-foreground hover:text-foreground px-2 text-xs transition"
                          >
                            {service.active ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                        <form action={deleteServiceAction} className="ml-auto">
                          <input type="hidden" name="id" value={service.id} />
                          <button
                            type="submit"
                            className="text-muted-foreground hover:text-destructive px-2 text-xs transition"
                          >
                            Borrar
                          </button>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

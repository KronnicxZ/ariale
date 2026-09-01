"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deletePackageAction, savePackageAction } from "@/actions/catalog";
import { useFormAction } from "@/hooks/use-form-action";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

type ServiceOption = {
  id: string;
  name: string;
  priceCents: number;
  category: { name: string };
};

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  sessions: number;
  priceCents: number;
  validityDays: number;
  active: boolean;
  services: { serviceId: string }[];
};

export function PackageDialog({
  pkg,
  services,
}: {
  pkg?: Pkg;
  services: ServiceOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(
    pkg?.services.map((s) => s.serviceId) ?? [],
  );
  const [sessions, setSessions] = useState(pkg?.sessions ?? 6);
  const [state, action, pending] = useFormAction(savePackageAction, () => setOpen(false));

  const perSessionCents = services
    .filter((s) => selected.includes(s.id))
    .reduce((sum, s) => sum + s.priceCents, 0);
  const regularCents = perSessionCents * sessions;

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {pkg ? (
          <Button size="xs" variant="ghost">
            <Pencil className="size-3.5" />
            Editar bono
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            Nuevo bono
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pkg ? "Editar bono" : "Nuevo bono"}</DialogTitle>
          <DialogDescription>
            La clienta paga por adelantado y va consumiendo sesiones en cada visita.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {pkg ? <input type="hidden" name="id" value={pkg.id} /> : null}
          {selected.map((id) => (
            <input key={id} type="hidden" name="serviceIds" value={id} />
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="package-name">Nombre</Label>
            <Input
              id="package-name"
              name="name"
              defaultValue={pkg?.name}
              placeholder="Bono 6 sesiones — Axilas"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="package-description">Descripción</Label>
            <Textarea
              id="package-description"
              name="description"
              defaultValue={pkg?.description ?? ""}
              rows={2}
              placeholder="Lo que ve la clienta"
            />
          </div>

          <div className="space-y-2">
            <Label>¿Qué servicios cubre cada sesión?</Label>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border p-2">
              {services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggle(service.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
                    selected.includes(service.id)
                      ? "bg-primary/12 text-primary font-medium"
                      : "hover:bg-accent",
                  )}
                >
                  <span className="min-w-0 truncate">
                    {service.name}
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      {service.category.name}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatUsd(service.priceCents)}</span>
                </button>
              ))}
            </div>
            {selected.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                Cada sesión vale {formatUsd(perSessionCents)} suelta. {sessions} sesiones sueltas
                serían <strong>{formatUsd(regularCents)}</strong>.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="package-sessions">Sesiones</Label>
              <Input
                id="package-sessions"
                name="sessions"
                type="number"
                min={2}
                value={sessions}
                onChange={(event) => setSessions(Math.max(2, Number(event.target.value)))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="package-price">Precio $</Label>
              <Input
                id="package-price"
                name="price"
                inputMode="decimal"
                defaultValue={pkg ? (pkg.priceCents / 100).toFixed(2) : ""}
                placeholder="25.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="package-validity">Validez (días)</Label>
              <Input
                id="package-validity"
                name="validityDays"
                type="number"
                min={30}
                defaultValue={pkg?.validityDays ?? 365}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="package-active">Bono activo</Label>
            <Switch id="package-active" name="active" defaultChecked={pkg?.active ?? true} />
          </div>

          {state?.error ? (
            <p className="text-destructive flex items-start gap-1.5 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending} className="h-11 flex-1">
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Guardar bono
            </Button>
            {pkg ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive h-11"
                onClick={async () => {
                  const formData = new FormData();
                  formData.set("id", pkg.id);
                  await deletePackageAction(formData);
                  setOpen(false);
                  router.refresh();
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

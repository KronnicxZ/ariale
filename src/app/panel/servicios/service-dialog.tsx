"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Pencil, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveServiceAction } from "@/actions/catalog";
import { useFormAction } from "@/hooks/use-form-action";

const METHODS = [
  { value: "NONE", label: "No aplica" },
  { value: "WAX", label: "Cera" },
  { value: "SUGAR", label: "Azúcar" },
  { value: "LASER", label: "Láser" },
  { value: "THREAD", label: "Hilo" },
  { value: "RAZOR", label: "Cuchilla" },
];

type Service = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMin: number;
  categoryId: string;
  active: boolean;
  order: number;
  bodyZone: string | null;
  method: string;
  sessionIntervalDays: number | null;
  requiresPatchTest: boolean;
};

export function ServiceDialog({
  service,
  categories,
  defaultCategoryId,
}: {
  service?: Service;
  categories: { id: string; name: string; kind: string }[];
  defaultCategoryId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(saveServiceAction, () => setOpen(false));
  const [categoryId, setCategoryId] = useState(
    service?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
  );

  const isDepilation = categories.find((c) => c.id === categoryId)?.kind === "DEPILATION";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {service ? (
          <Button size="xs" variant="ghost">
            <Pencil className="size-3.5" />
            Editar
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            Nuevo servicio
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
          <DialogDescription>
            El precio y la duración se congelan en cada cita al agendar.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {service ? <input type="hidden" name="id" value={service.id} /> : null}
          <input type="hidden" name="categoryId" value={categoryId} />

          <div className="space-y-1.5">
            <Label htmlFor="service-name">Nombre</Label>
            <Input
              id="service-name"
              name="name"
              defaultValue={service?.name}
              placeholder="Esmaltado Semipermanente"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="service-price">Precio $</Label>
              <Input
                id="service-price"
                name="price"
                inputMode="decimal"
                defaultValue={service ? (service.priceCents / 100).toFixed(2) : ""}
                placeholder="12.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-duration">Duración (min)</Label>
              <Input
                id="service-duration"
                name="durationMin"
                type="number"
                min={5}
                step={5}
                defaultValue={service?.durationMin ?? 60}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service-description">Descripción</Label>
            <Textarea
              id="service-description"
              name="description"
              defaultValue={service?.description ?? ""}
              rows={2}
              placeholder="Opcional · lo ve la clienta al reservar"
            />
          </div>

          {isDepilation ? (
            <div className="bg-muted/50 space-y-3 rounded-xl p-3">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Depilación
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="service-zone">Zona del cuerpo</Label>
                  <Input
                    id="service-zone"
                    name="bodyZone"
                    defaultValue={service?.bodyZone ?? ""}
                    placeholder="Piernas, Axilas…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="service-method">Método</Label>
                  <Select name="method" defaultValue={service?.method ?? "WAX"}>
                    <SelectTrigger id="service-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="service-interval">Repetir cada (días)</Label>
                <Input
                  id="service-interval"
                  name="sessionIntervalDays"
                  type="number"
                  min={0}
                  defaultValue={service?.sessionIntervalDays ?? 28}
                />
                <p className="text-muted-foreground text-xs">
                  Con esto la app avisa cuándo toca la próxima sesión de cada clienta.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="requiresPatchTest"
                  defaultChecked={service?.requiresPatchTest}
                  className="accent-primary size-4"
                />
                Requiere prueba de sensibilidad
              </label>
            </div>
          ) : (
            <>
              <input type="hidden" name="method" value="NONE" />
              <input type="hidden" name="sessionIntervalDays" value="0" />
            </>
          )}

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="service-active">Servicio activo</Label>
              <p className="text-muted-foreground text-xs">
                Los inactivos no aparecen al agendar.
              </p>
            </div>
            <Switch id="service-active" name="active" defaultChecked={service?.active ?? true} />
          </div>

          {state?.error ? (
            <p className="text-destructive flex items-start gap-1.5 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {state.error}
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="h-11 w-full">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar servicio
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

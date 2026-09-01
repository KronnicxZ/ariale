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
import { deleteSpecialistAction, saveSpecialistAction } from "@/actions/catalog";
import { useFormAction } from "@/hooks/use-form-action";
import { cn } from "@/lib/utils";

const SWATCHES = ["#E9B21C", "#E9A8B4", "#A8C7A9", "#BDAEDC", "#A6C4DC", "#F0C79A"];

type ServiceOption = { id: string; name: string; category: { name: string } };

type Specialist = {
  id: string;
  name: string;
  pin: string;
  phone: string | null;
  email: string | null;
  color: string;
  active: boolean;
  skills: { serviceId: string }[];
};

export function SpecialistDialog({
  specialist,
  services,
}: {
  specialist?: Specialist;
  services: ServiceOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(specialist?.color ?? SWATCHES[0]);
  const [selected, setSelected] = useState<string[]>(
    specialist?.skills.map((s) => s.serviceId) ?? services.map((s) => s.id),
  );
  const [state, action, pending] = useFormAction(saveSpecialistAction, () => setOpen(false));

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const groups = new Map<string, ServiceOption[]>();
  for (const service of services) {
    const list = groups.get(service.category.name) ?? [];
    list.push(service);
    groups.set(service.category.name, list);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {specialist ? (
          <Button size="xs" variant="ghost">
            <Pencil className="size-3.5" />
            Editar
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            Nueva especialista
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{specialist ? "Editar especialista" : "Nueva especialista"}</DialogTitle>
          <DialogDescription>
            Con su clave de 4 dígitos entra solo a su agenda, no al panel.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {specialist ? <input type="hidden" name="id" value={specialist.id} /> : null}
          <input type="hidden" name="color" value={color} />
          {selected.map((id) => (
            <input key={id} type="hidden" name="serviceIds" value={id} />
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="specialist-name">Nombre</Label>
            <Input
              id="specialist-name"
              name="name"
              defaultValue={specialist?.name}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="specialist-pin">Clave (4 dígitos)</Label>
              <Input
                id="specialist-pin"
                name="pin"
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                defaultValue={specialist?.pin ?? ""}
                placeholder="1234"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="specialist-phone">Teléfono</Label>
              <Input
                id="specialist-phone"
                name="phone"
                inputMode="tel"
                defaultValue={specialist?.phone ?? ""}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="specialist-email">Correo</Label>
            <Input
              id="specialist-email"
              name="email"
              type="email"
              defaultValue={specialist?.email ?? ""}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color en la agenda</Label>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  style={{ background: swatch }}
                  aria-label={`Color ${swatch}`}
                  className={
                    color === swatch
                      ? "ring-foreground size-8 rounded-full ring-2 ring-offset-2"
                      : "size-8 rounded-full"
                  }
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
                aria-label="Color personalizado"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>¿Qué servicios hace?</Label>
              <button
                type="button"
                onClick={() =>
                  setSelected(selected.length === services.length ? [] : services.map((s) => s.id))
                }
                className="text-primary text-xs underline"
              >
                {selected.length === services.length ? "Ninguno" : "Todos"}
              </button>
            </div>
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border p-2">
              {[...groups.entries()].map(([categoryName, items]) => (
                <div key={categoryName}>
                  <p className="text-muted-foreground px-1.5 pb-1 text-[0.65rem] font-semibold uppercase">
                    {categoryName}
                  </p>
                  {items.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggle(service.id)}
                      className={cn(
                        "block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition",
                        selected.includes(service.id)
                          ? "bg-primary/12 text-primary font-medium"
                          : "hover:bg-accent",
                      )}
                    >
                      {service.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="specialist-active">Activa</Label>
            <Switch
              id="specialist-active"
              name="active"
              defaultChecked={specialist?.active ?? true}
            />
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
              Guardar
            </Button>
            {specialist ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive h-11"
                onClick={async () => {
                  const formData = new FormData();
                  formData.set("id", specialist.id);
                  await deleteSpecialistAction(formData);
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

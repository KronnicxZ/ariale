"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FolderPlus, Loader2, Settings2, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteCategoryAction, saveCategoryAction } from "@/actions/catalog";
import { useFormAction } from "@/hooks/use-form-action";

const KINDS = [
  { value: "MANICURE", label: "Manicura" },
  { value: "PEDICURE", label: "Pedicura" },
  { value: "DEPILATION", label: "Depilación" },
  { value: "OTHER", label: "Otros" },
];

const SWATCHES = ["#E9B21C", "#E9A8B4", "#A8C7A9", "#BDAEDC", "#A6C4DC", "#F0C79A"];

type Category = { id: string; name: string; kind: string; color: string; order: number };

export function CategoryDialog({ category }: { category?: Category }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(category?.color ?? SWATCHES[0]);
  const [state, action, pending] = useFormAction(saveCategoryAction, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {category ? (
          <Button size="xs" variant="ghost">
            <Settings2 className="size-3.5" />
            Categoría
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <FolderPlus className="size-4" />
            Nueva categoría
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>
            Agrupa los servicios. El tipo &quot;Depilación&quot; habilita zonas, método y ciclo de
            sesiones.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <input type="hidden" name="color" value={color} />

          <div className="space-y-1.5">
            <Label htmlFor="category-name">Nombre</Label>
            <Input
              id="category-name"
              name="name"
              defaultValue={category?.name}
              placeholder="Depilaciones"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category-kind">Tipo</Label>
              <Select name="kind" defaultValue={category?.kind ?? "OTHER"}>
                <SelectTrigger id="category-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((kind) => (
                    <SelectItem key={kind.value} value={kind.value}>
                      {kind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-order">Orden</Label>
              <Input
                id="category-order"
                name="order"
                type="number"
                min={0}
                defaultValue={category?.order ?? 0}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
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
            {category ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive h-11"
                onClick={async () => {
                  const formData = new FormData();
                  formData.set("id", category.id);
                  await deleteCategoryAction(formData);
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

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
import { Textarea } from "@/components/ui/textarea";
import { deleteSupplierAction, saveSupplierAction } from "@/actions/finance";
import { useFormAction } from "@/hooks/use-form-action";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export function SupplierDialog({ supplier }: { supplier?: Supplier }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(saveSupplierAction, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {supplier ? (
          <Button size="sm" variant="outline" className="flex-1">
            <Pencil className="size-3.5" />
            Editar
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            Nuevo proveedor
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>
            Con el nombre basta. El teléfono sirve para escribirle por WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}

          <div className="space-y-1.5">
            <Label htmlFor="supplier-name">Nombre</Label>
            <Input
              id="supplier-name"
              name="name"
              defaultValue={supplier?.name}
              placeholder="Distribuidora Nails Center"
              required
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="supplier-phone">Teléfono</Label>
              <Input
                id="supplier-phone"
                name="phone"
                defaultValue={supplier?.phone ?? ""}
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-email">Correo</Label>
              <Input
                id="supplier-email"
                name="email"
                type="email"
                defaultValue={supplier?.email ?? ""}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supplier-notes">Notas</Label>
            <Textarea
              id="supplier-notes"
              name="notes"
              defaultValue={supplier?.notes ?? ""}
              rows={2}
              placeholder="Días de entrega, condiciones de pago…"
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
            {supplier ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive h-11"
                onClick={async () => {
                  const formData = new FormData();
                  formData.set("id", supplier.id);
                  await deleteSupplierAction(formData);
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

"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveClientAction } from "@/actions/clients";
import type { ActionState } from "@/actions/shared";

type Client = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  instagram: string | null;
  birthday: Date | null;
  notes: string | null;
  allergies: string | null;
};

export function ClientForm({
  client,
  countryCode,
}: {
  client?: Client;
  countryCode: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveClientAction, null);

  useEffect(() => {
    if (state?.success && state.id) {
      toast.success(state.success);
      router.push(`/panel/clientes/${state.id}`);
    }
  }, [state, router]);

  return (
    <form action={action} className="bg-card space-y-5 rounded-2xl border p-5">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Nombre y apellido</Label>
          <Input
            id="name"
            name="name"
            defaultValue={client?.name}
            placeholder="Camila Reyes"
            required
            autoFocus={!client}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <div className="flex items-center gap-2">
            <span className="bg-muted text-muted-foreground shrink-0 rounded-lg px-2.5 py-2 text-sm">
              {countryCode}
            </span>
            <Input
              id="phone"
              name="phone"
              defaultValue={client?.phone}
              inputMode="tel"
              placeholder="0424 135 4645"
              required
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Es su llave de entrada al enlace de reservas.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="birthday">Cumpleaños</Label>
          <Input
            id="birthday"
            name="birthday"
            type="date"
            defaultValue={client?.birthday?.toISOString().slice(0, 10)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={client?.email ?? ""}
            placeholder="opcional"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="instagram">Instagram</Label>
          <Input
            id="instagram"
            name="instagram"
            defaultValue={client?.instagram ?? ""}
            placeholder="@usuaria"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="allergies">Alergias o sensibilidades</Label>
          <Input
            id="allergies"
            name="allergies"
            defaultValue={client?.allergies ?? ""}
            placeholder="Ej.: sensible a la cera caliente"
          />
          <p className="text-muted-foreground text-xs">
            Aparece resaltado al abrir su cita, para no olvidarlo.
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={client?.notes ?? ""}
            rows={3}
            placeholder="Preferencias de diseño, forma de uña, lo que sea útil recordar"
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
        <Button type="submit" disabled={pending} className="h-11">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {client ? "Guardar cambios" : "Registrar clienta"}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

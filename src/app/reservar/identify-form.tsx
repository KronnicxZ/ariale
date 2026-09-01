"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientIdentifyAction } from "@/actions/client-zone";
import type { ActionState } from "@/actions/shared";
import { normalizePhone } from "@/lib/utils";

/**
 * Puerta de entrada de la clienta: solo el teléfono. Si es nueva, en el mismo
 * formulario se le pide el nombre y ya queda registrada.
 */
export function IdentifyForm({
  business,
  countryCode,
}: {
  business: string;
  countryCode: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    clientIdentifyAction,
    null,
  );
  const [phone, setPhone] = useState("");

  const needsName = state?.error === "NEEDS_NAME";
  const otherError = state?.error && state.error !== "NEEDS_NAME" ? state.error : null;

  return (
    <div className="soft-blush flex flex-1 flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">Hola</p>
        <h1 className="font-heading mt-1 text-4xl font-semibold">
          {needsName ? "¿Cómo te llamas?" : "Bienvenida"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {needsName
            ? "Es la primera vez que agendas con nosotras. Con tu nombre queda listo."
            : `Escribe tu número para agendar con ${business}. Si ya vienes, entras a tu cuenta.`}
        </p>

        <form action={action} className="mt-7 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Tu número de teléfono</Label>
            <div className="flex items-center gap-2">
              <span className="bg-card flex h-12 shrink-0 items-center rounded-xl border px-3 text-sm font-medium">
                {countryCode}
              </span>
              <Input
                id="phone"
                name="phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="0424 135 4645"
                className="h-12"
                readOnly={needsName}
                required
                autoFocus={!needsName}
              />
            </div>
            {!needsName ? (
              <p className="text-muted-foreground text-xs">
                Si es tu primera vez, después te pedimos el nombre.
              </p>
            ) : null}
          </div>

          {needsName ? (
            <div className="space-y-1.5">
              <Label htmlFor="name">Tu nombre</Label>
              <Input
                id="name"
                name="name"
                placeholder="Nombre y apellido"
                className="h-12"
                required
                autoFocus
              />
            </div>
          ) : null}

          {otherError ? (
            <p className="text-destructive flex items-start gap-1.5 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {otherError}
            </p>
          ) : null}

          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={pending || normalizePhone(phone).length < 10}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {needsName ? "Entrar" : "Continuar"}
            {!pending ? <ArrowRight className="size-4" /> : null}
          </Button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { specialistLoginAction, type ActionState } from "@/actions/auth";
import { cn, firstName } from "@/lib/utils";

/**
 * Entrada de 4 dígitos. Al completarlos se envía sola, sin botón, que es como
 * lo hace la app original: se abre el enlace, se teclea y ya estás dentro.
 */
export function PinGate({
  slug,
  name,
  business,
  logoUrl,
}: {
  slug: string;
  name: string;
  business: string;
  logoUrl: string | null;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  // Al fallar, vaciamos la clave desde la propia acción: así el campo queda
  // listo para reintentar sin encadenar renders.
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await specialistLoginAction(prev, formData);
      if (result?.error) {
        setDigits(["", "", "", ""]);
        inputs.current[0]?.focus();
      }
      return result;
    },
    null,
  );

  const pin = digits.join("");

  // Enviar al completar los 4 dígitos es una acción sobre el DOM, no un cambio
  // de estado, así que el efecto es el sitio correcto.
  useEffect(() => {
    if (pin.length === 4 && !pending) formRef.current?.requestSubmit();
  }, [pin, pending]);

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((current) => current.map((d, i) => (i === index ? "" : d)));
      return;
    }
    setDigits((current) => {
      const next = [...current];
      // Pegar el código completo de una vez también funciona.
      for (let i = 0; i < clean.length && index + i < 4; i++) next[index + i] = clean[i];
      return next;
    });
    const target = Math.min(index + clean.length, 3);
    inputs.current[target]?.focus();
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      setDigits((current) => current.map((d, i) => (i === index - 1 ? "" : d)));
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-card flex items-center gap-3 border-b px-4 py-3">
        <BrandMark logoUrl={logoUrl} name={business} height={30} />
        <div className="min-w-0 border-l pl-3">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-muted-foreground text-xs">Agenda rápida</p>
        </div>
      </header>

      <div className="soft-blush flex flex-1 flex-col items-center px-5 pt-10">
        <div className="bg-card w-full max-w-sm rounded-3xl border p-6 shadow-sm">
          <p className="text-primary text-xs font-semibold tracking-widest uppercase">Solo tú</p>
          <h1 className="font-display mt-1 text-3xl font-semibold">Hola, {firstName(name)}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Escribe tu clave para ver tu agenda.
          </p>

          <form ref={formRef} action={action} className="mt-6">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="pin" value={pin} />

            <div className="flex justify-between gap-2.5">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputs.current[index] = element;
                  }}
                  value={digit}
                  onChange={(event) => handleChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  autoFocus={index === 0}
                  aria-label={`Dígito ${index + 1}`}
                  className={cn(
                    "border-input focus:border-primary focus:ring-primary/25 h-16 w-full rounded-2xl border-2 text-center text-2xl font-semibold transition outline-none focus:ring-4",
                    digit && "border-primary/60",
                  )}
                />
              ))}
            </div>

            <p className="text-muted-foreground mt-3 text-sm">
              {pending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  Entrando…
                </span>
              ) : (
                `${pin.length} de 4 · entras al completarlos`
              )}
            </p>

            {state?.error ? (
              <p className="text-destructive mt-3 flex items-start gap-1.5 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {state.error}
              </p>
            ) : null}
          </form>
        </div>

        <p className="text-muted-foreground mt-5 max-w-xs text-center text-xs">
          Esta clave solo abre tu agenda. No entra al panel de {business} ni a las ventas.
        </p>
      </div>
    </main>
  );
}

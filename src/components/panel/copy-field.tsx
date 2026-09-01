"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Campo de solo lectura con botón de copiar y, opcionalmente, compartir por WhatsApp. */
export function CopyField({
  value,
  shareMessage,
  className,
}: {
  value: string;
  shareMessage?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Sin permiso de portapapeles: el texto sigue seleccionable a mano.
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <input
        readOnly
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        className="bg-muted/60 text-muted-foreground h-9 min-w-0 flex-1 rounded-lg border px-3 font-mono text-xs"
      />
      <button
        type="button"
        onClick={copy}
        className={cn(
          "grid h-9 w-16 shrink-0 place-items-center rounded-lg text-xs font-medium transition",
          copied
            ? "bg-success/15 text-success"
            : "bg-primary text-primary-foreground hover:opacity-90",
        )}
      >
        {copied ? (
          <span className="flex items-center gap-1">
            <Check className="size-3.5" />
            Listo
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Copy className="size-3.5" />
            Copiar
          </span>
        )}
      </button>
      {shareMessage ? (
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
          target="_blank"
          rel="noreferrer"
          className="bg-success/12 text-success hover:bg-success/20 grid size-9 shrink-0 place-items-center rounded-lg transition"
          aria-label="Compartir por WhatsApp"
        >
          <MessageCircle className="size-4" />
        </a>
      ) : null}
    </div>
  );
}

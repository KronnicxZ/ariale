"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="bg-destructive/10 text-destructive mb-5 grid size-14 place-items-center rounded-2xl">
        <AlertTriangle className="size-7" />
      </span>
      <h1 className="font-display text-2xl font-semibold">Algo se rompió</h1>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        No pudimos cargar esta pantalla. Vuelve a intentarlo; si sigue pasando, avísanos.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground mt-2 font-mono text-xs">Ref: {error.digest}</p>
      ) : null}
      <Button onClick={reset} className="mt-6">
        <RotateCcw className="size-4" />
        Reintentar
      </Button>
    </main>
  );
}

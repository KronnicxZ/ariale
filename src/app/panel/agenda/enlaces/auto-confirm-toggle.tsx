"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setAutoConfirmAction } from "@/actions/settings";

export function AutoConfirmToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = (value: boolean) => {
    startTransition(async () => {
      await setAutoConfirmAction(value);
      toast.success(
        value
          ? "Las reservas quedarán confirmadas al instante."
          : "Ahora las reservas esperan tu confirmación.",
      );
      router.refresh();
    });
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-semibold">Confirmar citas automáticamente</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {enabled
            ? "Encendido: lo que reserva la clienta entra directo a la agenda como confirmado."
            : "Apagado: las reservas de las clientas llegan como pendientes hasta que tú las confirmes."}
        </p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={toggle}
        disabled={pending}
        aria-label="Confirmar citas automáticamente"
      />
    </div>
  );
}

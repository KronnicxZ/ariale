"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionState } from "@/actions/shared";

/**
 * Envuelve una server action de formulario para avisar, refrescar y ejecutar
 * el efecto de éxito (cerrar el diálogo, navegar) dentro de la propia acción.
 * Así no hace falta un useEffect que reaccione al estado, que provoca renders
 * en cascada.
 */
export function useFormAction(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  onSuccess?: (result: NonNullable<ActionState>) => void,
) {
  const router = useRouter();

  return useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result?.success) {
      toast.success(result.success);
      onSuccess?.(result);
      router.refresh();
    }
    return result;
  }, null);
}

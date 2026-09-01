"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPurchasePaymentAction } from "@/actions/finance";
import type { ActionState } from "@/actions/shared";
import { PAYMENT_METHOD_LABELS, formatUsd } from "@/lib/money";

export function PurchasePaymentForm({
  purchaseId,
  balanceCents,
}: {
  purchaseId: string;
  balanceCents: number;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addPurchasePaymentAction,
    null,
  );
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const [method, setMethod] = useState("TRANSFER");

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="purchaseId" value={purchaseId} />
      <input type="hidden" name="method" value={method} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Monto $</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setAmount((balanceCents / 100).toFixed(2))}
            className="text-primary text-xs underline"
          >
            Pagar todo ({formatUsd(balanceCents)})
          </button>
        </div>

        <div className="space-y-1.5">
          <Label>Método</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reference">Referencia</Label>
        <Input id="reference" name="reference" placeholder="Opcional" />
      </div>

      {state?.error ? (
        <p className="text-destructive flex items-start gap-1.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
        Registrar pago
      </Button>
    </form>
  );
}

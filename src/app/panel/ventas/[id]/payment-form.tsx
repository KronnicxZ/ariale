"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, HandCoins, Loader2 } from "lucide-react";
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
import { addPaymentAction } from "@/actions/sales";
import type { ActionState } from "@/actions/shared";
import { PAYMENT_METHOD_LABELS, formatBs, formatUsd } from "@/lib/money";

export function PaymentForm({
  saleId,
  balanceCents,
  rate,
}: {
  saleId: string;
  balanceCents: number;
  rate: number;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(addPaymentAction, null);
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const [method, setMethod] = useState("CASH_USD");

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.refresh();
    }
  }, [state, router]);

  const amountCents = Math.round((parseFloat(amount.replace(",", ".")) || 0) * 100);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="saleId" value={saleId} />
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
          {rate && amountCents > 0 ? (
            <p className="text-muted-foreground text-xs tabular-nums">
              {formatBs(amountCents, rate)}
            </p>
          ) : null}
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
        <Input id="reference" name="reference" placeholder="Nº de operación, opcional" />
      </div>

      <div className="flex flex-wrap gap-2">
        {[25, 50, 100].map((percent) => (
          <button
            key={percent}
            type="button"
            onClick={() =>
              setAmount(((balanceCents * percent) / 100 / 100).toFixed(2))
            }
            className="bg-secondary text-secondary-foreground hover:bg-accent rounded-full px-3 py-1 text-xs font-medium transition"
          >
            {percent === 100 ? `Todo (${formatUsd(balanceCents)})` : `${percent}%`}
          </button>
        ))}
      </div>

      {state?.error ? (
        <p className="text-destructive flex items-start gap-1.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <HandCoins className="size-4" />}
        Registrar abono
      </Button>
    </form>
  );
}

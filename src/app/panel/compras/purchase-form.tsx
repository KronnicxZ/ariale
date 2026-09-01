"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { savePurchaseAction } from "@/actions/finance";
import type { ActionState } from "@/actions/shared";
import { PAYMENT_METHOD_LABELS, formatUsd } from "@/lib/money";

type Purchase = {
  id: string;
  description: string;
  totalCents: number;
  paidCents: number;
  supplierId: string | null;
  date: Date;
  dueDate: Date | null;
  notes: string | null;
};

export function PurchaseForm({
  purchase,
  suppliers,
  today,
}: {
  purchase?: Purchase;
  suppliers: { id: string; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(savePurchaseAction, null);
  const [total, setTotal] = useState(purchase ? (purchase.totalCents / 100).toFixed(2) : "");
  const [paid, setPaid] = useState(purchase ? (purchase.paidCents / 100).toFixed(2) : "");

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.push("/panel/compras");
    }
  }, [state, router]);

  const totalCents = Math.round((parseFloat(total.replace(",", ".")) || 0) * 100);
  const paidCents = Math.round((parseFloat(paid.replace(",", ".")) || 0) * 100);
  const balanceCents = Math.max(0, totalCents - paidCents);

  return (
    <form action={action} className="surface space-y-4 p-5">
      {purchase ? <input type="hidden" name="id" value={purchase.id} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="description">¿Qué compraste?</Label>
        <Input
          id="description"
          name="description"
          defaultValue={purchase?.description}
          placeholder="Ej.: cera brasileña, esmaltes, tips"
          required
          autoFocus
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="supplierId">Proveedor</Label>
          <Select name="supplierId" defaultValue={purchase?.supplierId ?? undefined}>
            <SelectTrigger id="supplierId">
              <SelectValue placeholder="Sin proveedor" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={purchase ? purchase.date.toISOString().slice(0, 10) : today}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="total">Monto total $</Label>
          <Input
            id="total"
            name="total"
            inputMode="decimal"
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="paid">Pagaste ahora $</Label>
          <Input
            id="paid"
            name="paid"
            inputMode="decimal"
            value={paid}
            onChange={(event) => setPaid(event.target.value)}
            placeholder="0.00"
          />
          <button
            type="button"
            onClick={() => setPaid(total)}
            className="text-primary text-xs underline"
          >
            Pagué todo
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="method">Forma de pago</Label>
          <Select name="method" defaultValue="TRANSFER">
            <SelectTrigger id="method">
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

        {balanceCents > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">¿Cuándo hay que pagar el resto?</Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={purchase?.dueDate?.toISOString().slice(0, 10)}
            />
          </div>
        ) : null}
      </div>

      {balanceCents > 0 ? (
        <p className="bg-warning/10 text-warning-foreground rounded-lg px-3 py-2 text-sm">
          Quedan <strong>{formatUsd(balanceCents)}</strong> por pagar. Aparecerá en Cuentas por
          pagar.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={purchase?.notes ?? ""}
          rows={2}
          placeholder="Opcional"
        />
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
          {purchase ? "Guardar cambios" : "Registrar compra"}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

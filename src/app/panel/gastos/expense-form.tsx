"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Save } from "lucide-react";
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
import { saveExpenseAction } from "@/actions/finance";
import type { ActionState } from "@/actions/shared";
import { PAYMENT_METHOD_LABELS } from "@/lib/money";

type Expense = {
  id: string;
  description: string;
  amountCents: number;
  categoryId: string | null;
  method: string;
  date: Date;
};

export function ExpenseForm({
  expense,
  categories,
  today,
}: {
  expense?: Expense;
  categories: { id: string; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveExpenseAction, null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.push("/panel/gastos");
    }
  }, [state, router]);

  return (
    <form action={action} className="surface space-y-4 p-5">
      {expense ? <input type="hidden" name="id" value={expense.id} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="description">¿En qué fue el gasto?</Label>
        <Input
          id="description"
          name="description"
          defaultValue={expense?.description}
          placeholder="Ej.: alquiler del local, cera, publicidad"
          required
          autoFocus
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Monto $</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            defaultValue={expense ? (expense.amountCents / 100).toFixed(2) : ""}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={expense ? expense.date.toISOString().slice(0, 10) : today}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="categoryId">Categoría</Label>
          <Select name="categoryId" defaultValue={expense?.categoryId ?? undefined}>
            <SelectTrigger id="categoryId">
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="method">Forma de pago</Label>
          <Select name="method" defaultValue={expense?.method ?? "CASH_USD"}>
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
          {expense ? "Guardar cambios" : "Registrar gasto"}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

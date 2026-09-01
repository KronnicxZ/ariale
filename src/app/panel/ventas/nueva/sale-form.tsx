"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus, Receipt, Trash2 } from "lucide-react";
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
import { ClientPicker, type ClientSelection } from "@/components/booking/client-picker";
import type { ClientOption, PackageBalance, ServiceOption } from "@/components/booking/types";
import { createSaleAction } from "@/actions/sales";
import { PAYMENT_METHOD_LABELS } from "@/lib/money";
import { formatBs, formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

type Line = {
  key: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
  clientPackageId: string | null;
};

type Props = {
  clients: ClientOption[];
  services: ServiceOption[];
  specialists: { id: string; name: string }[];
  packages: { id: string; name: string; priceCents: number; sessions: number }[];
  rate: number;
  countryCode: string;
  today: string;
  /** Cuando se cobra una cita, viene precargada. */
  prefill?: {
    client: ClientSelection;
    specialistId: string | null;
    appointmentId: string;
    lines: { serviceId: string; description: string; unitPriceCents: number }[];
  };
  /** Bonos con saldo de la clienta precargada. */
  prefillPackages?: PackageBalance[];
};

let counter = 0;
const nextKey = () => `line-${++counter}`;

export function SaleForm({
  clients,
  services,
  specialists,
  packages,
  rate,
  countryCode,
  today,
  prefill,
  prefillPackages = [],
}: Props) {
  const router = useRouter();
  const [client, setClient] = useState<ClientSelection | null>(prefill?.client ?? null);
  const [specialistId, setSpecialistId] = useState<string>(prefill?.specialistId ?? "");
  const [lines, setLines] = useState<Line[]>(
    prefill?.lines.map((line) => ({
      key: nextKey(),
      serviceId: line.serviceId,
      description: line.description,
      quantity: 1,
      unitPrice: (line.unitPriceCents / 100).toFixed(2),
      clientPackageId: null,
    })) ?? [
      { key: nextKey(), serviceId: null, description: "", quantity: 1, unitPrice: "", clientPackageId: null },
    ],
  );
  const [discount, setDiscount] = useState("");
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [packageId, setPackageId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH_USD");
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedPackage = packages.find((p) => p.id === packageId);

  const subtotalCents = useMemo(() => {
    const lineTotal = lines.reduce((sum, line) => {
      if (line.clientPackageId) return sum;
      const price = Math.round((parseFloat(line.unitPrice.replace(",", ".")) || 0) * 100);
      return sum + price * line.quantity;
    }, 0);
    return lineTotal + (selectedPackage?.priceCents ?? 0);
  }, [lines, selectedPackage]);

  const discountCents = Math.round((parseFloat(discount.replace(",", ".")) || 0) * 100);
  const totalCents = Math.max(0, subtotalCents - discountCents);
  const paymentCents = Math.round((parseFloat(paymentAmount.replace(",", ".")) || 0) * 100);
  const balanceCents = Math.max(0, totalCents - Math.min(paymentCents, totalCents));

  const updateLine = (key: string, patch: Partial<Line>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const pickService = (key: string, serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;
    updateLine(key, {
      serviceId,
      description: service.name,
      unitPrice: (service.priceCents / 100).toFixed(2),
    });
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      { key: nextKey(), serviceId: null, description: "", quantity: 1, unitPrice: "", clientPackageId: null },
    ]);
  };

  const removeLine = (key: string) => {
    setLines((current) => (current.length === 1 ? current : current.filter((l) => l.key !== key)));
  };

  const submit = () => {
    if (!client) {
      setError("Elige una clienta.");
      return;
    }
    if (client.kind === "new") {
      setError("Registra primero a la clienta desde el directorio.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createSaleAction({
        clientId: client.id,
        specialistId: specialistId || null,
        appointmentId: prefill?.appointmentId ?? null,
        items: lines
          .filter((line) => line.description.trim())
          .map((line) => ({
            serviceId: line.serviceId,
            description: line.description,
            quantity: line.quantity,
            unitPriceCents: Math.round((parseFloat(line.unitPrice.replace(",", ".")) || 0) * 100),
            clientPackageId: line.clientPackageId,
          })),
        discountCents,
        date,
        dueDate: balanceCents > 0 ? dueDate || null : null,
        notes: notes || null,
        packageId: packageId || null,
        payment:
          paymentCents > 0
            ? {
                amountCents: paymentCents,
                method: paymentMethod as never,
                reference: paymentReference || null,
              }
            : null,
      });

      if (result?.error) {
        setError(result.error);
        return;
      }
      toast.success(result?.success ?? "Venta registrada.");
      router.push(result?.id ? `/panel/ventas/${result.id}` : "/panel/ventas");
    });
  };

  return (
    <div className="space-y-5">
      <section className="bg-card space-y-3 rounded-2xl border p-5">
        <h2 className="font-semibold">Clienta</h2>
        <ClientPicker
          clients={clients}
          value={client}
          onChange={setClient}
          countryCode={countryCode}
        />
        {client?.kind === "new" ? (
          <p className="text-warning-foreground bg-warning/10 rounded-lg px-3 py-2 text-xs">
            Para facturar, registra a la clienta primero en el directorio.
          </p>
        ) : null}

        {specialists.length > 0 ? (
          <div className="space-y-1.5">
            <Label>Especialista</Label>
            <Select value={specialistId} onValueChange={setSpecialistId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {specialists.map((specialist) => (
                  <SelectItem key={specialist.id} value={specialist.id}>
                    {specialist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </section>

      <section className="bg-card space-y-3 rounded-2xl border p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Servicios</h2>
          <Button type="button" size="sm" variant="outline" onClick={addLine}>
            <Plus className="size-4" />
            Agregar línea
          </Button>
        </div>

        <div className="space-y-3">
          {lines.map((line) => {
            const coveringPackage = prefillPackages.find(
              (pkg) => line.serviceId && pkg.serviceIds.includes(line.serviceId),
            );
            return (
              <div key={line.key} className="bg-muted/40 space-y-2 rounded-xl p-3">
                <div className="flex gap-2">
                  <Select
                    value={line.serviceId ?? ""}
                    onValueChange={(value) => pickService(line.key, value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Elegir del catálogo" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} · {formatUsd(service.priceCents)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                    aria-label="Quitar línea"
                  >
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </div>

                <Input
                  value={line.description}
                  onChange={(event) => updateLine(line.key, { description: event.target.value })}
                  placeholder="Descripción (o escríbela libre)"
                />

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Cantidad</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, { quantity: Math.max(1, Number(event.target.value)) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Precio $</Label>
                    <Input
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                      placeholder="0.00"
                      disabled={Boolean(line.clientPackageId)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Subtotal</Label>
                    <div className="bg-background flex h-9 items-center rounded-lg border px-3 text-sm tabular-nums">
                      {line.clientPackageId
                        ? "Bono"
                        : formatUsd(
                            Math.round(
                              (parseFloat(line.unitPrice.replace(",", ".")) || 0) *
                                100 *
                                line.quantity,
                            ),
                          )}
                    </div>
                  </div>
                </div>

                {coveringPackage && coveringPackage.remaining > 0 ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={line.clientPackageId === coveringPackage.id}
                      onChange={(event) =>
                        updateLine(line.key, {
                          clientPackageId: event.target.checked ? coveringPackage.id : null,
                        })
                      }
                      className="accent-primary size-4"
                    />
                    <span>
                      Descontar de <strong>{coveringPackage.name}</strong> (
                      {coveringPackage.remaining} sesiones)
                    </span>
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>

        {packages.length > 0 ? (
          <div className="space-y-1.5 border-t pt-3">
            <Label>Vender un bono en esta venta</Label>
            <Select value={packageId} onValueChange={setPackageId}>
              <SelectTrigger>
                <SelectValue placeholder="Ninguno" />
              </SelectTrigger>
              <SelectContent>
                {packages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} · {formatUsd(pkg.priceCents)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {packageId ? (
              <button
                type="button"
                onClick={() => setPackageId("")}
                className="text-muted-foreground text-xs underline"
              >
                Quitar el bono
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="bg-card space-y-4 rounded-2xl border p-5">
        <h2 className="font-semibold">Cobro</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="date">Fecha de la venta</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount">Descuento $</Label>
            <Input
              id="discount"
              inputMode="decimal"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="payment">Abono ahora $</Label>
            <Input
              id="payment"
              inputMode="decimal"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              placeholder="0.00"
            />
            <button
              type="button"
              onClick={() => setPaymentAmount((totalCents / 100).toFixed(2))}
              className="text-primary text-xs underline"
            >
              Cobrar el total
            </button>
          </div>
          <div className="space-y-1.5">
            <Label>Método</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
          <div className="space-y-1.5">
            <Label htmlFor="reference">Referencia</Label>
            <Input
              id="reference"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        {balanceCents > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">¿Cuándo termina de pagar?</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Con fecha de vencimiento, la deuda aparece en Cuentas por cobrar y avisa cuando se
              pasa.
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Opcional"
          />
        </div>
      </section>

      {error ? (
        <p className="text-destructive flex items-start gap-1.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="bg-card sticky bottom-20 rounded-2xl border p-4 shadow-lg lg:bottom-4">
        <dl className="mb-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatUsd(subtotalCents)}</dd>
          </div>
          {discountCents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Descuento</dt>
              <dd className="text-destructive tabular-nums">−{formatUsd(discountCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <dt>Total</dt>
            <dd className="text-right tabular-nums">
              {formatUsd(totalCents)}
              {rate ? (
                <span className="text-muted-foreground block text-xs font-normal">
                  {formatBs(totalCents, rate)}
                </span>
              ) : null}
            </dd>
          </div>
          {balanceCents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Queda debiendo</dt>
              <dd className={cn("font-medium tabular-nums", "text-destructive")}>
                {formatUsd(balanceCents)}
              </dd>
            </div>
          ) : null}
        </dl>

        <Button onClick={submit} disabled={pending} className="h-12 w-full text-base">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
          Registrar venta
        </Button>
      </div>
    </div>
  );
}

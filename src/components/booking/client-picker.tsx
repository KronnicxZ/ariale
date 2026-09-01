"use client";

import { useMemo, useState } from "react";
import { Check, Search, UserPlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatPhone, initials, normalizePhone } from "@/lib/utils";
import type { ClientOption } from "@/components/booking/types";

export type ClientSelection =
  | { kind: "existing"; id: string; name: string }
  | { kind: "new"; name: string; phone: string };

/**
 * Buscador de clientas con alta rápida. En el salón lo normal es que la
 * clienta ya exista; si no, se crea con nombre y teléfono y punto.
 */
export function ClientPicker({
  clients,
  value,
  onChange,
  countryCode = "+58",
}: {
  clients: ClientOption[];
  value: ClientSelection | null;
  onChange: (selection: ClientSelection | null) => void;
  countryCode?: string;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const digits = normalizePhone(query);
    if (!needle) return clients.slice(0, 8);
    return clients
      .filter(
        (client) =>
          client.name.toLowerCase().includes(needle) ||
          (digits.length >= 3 && client.phone.includes(digits)),
      )
      .slice(0, 8);
  }, [clients, query]);

  if (value) {
    return (
      <div className="border-primary bg-primary/8 flex items-center gap-3 rounded-2xl border p-3">
        <span className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold">
          {initials(value.name || "?")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{value.name}</p>
          <p className="text-muted-foreground text-xs">
            {value.kind === "new" ? `Nueva · ${formatPhone(value.phone, countryCode)}` : "Clienta registrada"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setCreating(false);
            setQuery("");
          }}
          className="text-muted-foreground hover:text-foreground grid size-8 shrink-0 place-items-center rounded-full transition"
          aria-label="Cambiar de clienta"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (creating) {
    const phoneOk = normalizePhone(newPhone).length >= 10;
    return (
      <div className="border-border bg-card space-y-3 rounded-2xl border p-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-client-name">Nombre</Label>
          <Input
            id="new-client-name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Nombre y apellido"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-client-phone">Teléfono</Label>
          <div className="flex items-center gap-2">
            <span className="bg-muted text-muted-foreground rounded-lg px-2.5 py-2 text-sm">
              {countryCode}
            </span>
            <Input
              id="new-client-phone"
              value={newPhone}
              onChange={(event) => setNewPhone(event.target.value)}
              inputMode="tel"
              placeholder="0424 135 4645"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!newName.trim() || !phoneOk}
            onClick={() =>
              onChange({ kind: "new", name: newName.trim(), phone: normalizePhone(newPhone) })
            }
            className="bg-primary text-primary-foreground flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            <Check className="size-4" />
            Usar esta clienta
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="text-muted-foreground rounded-lg px-3 py-2 text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre o teléfono"
          className="pl-9"
        />
      </div>

      <div className="space-y-1.5">
        {results.map((client) => (
          <button
            key={client.id}
            type="button"
            onClick={() => onChange({ kind: "existing", id: client.id, name: client.name })}
            className="border-border bg-card hover:border-primary/50 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition"
          >
            <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
              {initials(client.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{client.name}</span>
              <span className="text-muted-foreground block text-xs">
                {formatPhone(client.phone, countryCode)}
              </span>
            </span>
          </button>
        ))}

        {results.length === 0 ? (
          <p className="text-muted-foreground px-1 py-2 text-sm">
            No encontramos a nadie con eso.
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => {
          setCreating(true);
          setNewName(query.trim());
        }}
        className={cn(
          "text-primary flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2.5 text-sm font-medium transition",
          "border-primary/40 hover:bg-primary/5",
        )}
      >
        <UserPlus className="size-4" />
        Registrar clienta nueva
      </button>
    </div>
  );
}

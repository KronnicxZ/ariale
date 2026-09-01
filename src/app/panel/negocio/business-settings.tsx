"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, Check, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  refreshRateAction,
  saveAppearanceAction,
  saveCurrencyAction,
  saveIdentityAction,
  saveScheduleAction,
} from "@/actions/settings";
import type { ActionState } from "@/actions/shared";
import { DAY_NAMES } from "@/lib/date";
import { cn, readableOn } from "@/lib/utils";

type Settings = {
  businessName: string;
  tagline: string;
  logoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  slotMinutes: number;
  minHoursAhead: number;
  maxDaysAhead: number;
  currencyLabel: string;
  rateMode: string;
  manualRate: number;
  countryCode: string;
  timezone: string;
  accentColor: string;
  menuColor: string;
};

type Hour = { dayOfWeek: number; enabled: boolean; openTime: string; closeTime: string };

const ACCENT_SWATCHES = ["#E9B21C", "#F0C79A", "#E9A8B4", "#BDAEDC", "#A8C7A9", "#A6C4DC"];
const MENU_SWATCHES = ["#1A1A1A", "#000000", "#242424", "#2E2E33", "#1F262B", "#332E33"];

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) {
    return (
      <p className="text-destructive flex items-start gap-1.5 text-sm">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  return null;
}

export function BusinessSettings({
  settings,
  hours,
  rate,
}: {
  settings: Settings;
  hours: Hour[];
  rate: { value: number; source: string; stale: boolean };
}) {
  const router = useRouter();

  return (
    <Tabs defaultValue="identidad" className="gap-5">
      <TabsList className="no-scrollbar w-full justify-start overflow-x-auto">
        <TabsTrigger value="identidad">Identidad</TabsTrigger>
        <TabsTrigger value="horario">Horario</TabsTrigger>
        <TabsTrigger value="moneda">Moneda</TabsTrigger>
        <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
      </TabsList>

      <TabsContent value="identidad">
        <IdentityForm settings={settings} onSaved={() => router.refresh()} />
      </TabsContent>

      <TabsContent value="horario">
        <ScheduleForm settings={settings} hours={hours} onSaved={() => router.refresh()} />
      </TabsContent>

      <TabsContent value="moneda">
        <CurrencyForm settings={settings} rate={rate} onSaved={() => router.refresh()} />
      </TabsContent>

      <TabsContent value="apariencia">
        <AppearanceForm settings={settings} onSaved={() => router.refresh()} />
      </TabsContent>
    </Tabs>
  );
}

function IdentityForm({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveIdentityAction, null);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <form action={action} className="surface space-y-5 p-5">
      <div>
        <h2 className="font-semibold">Identidad</h2>
        <p className="text-muted-foreground text-sm">
          El nombre y el logo que ven las clientas en el enlace de reservas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="businessName">Nombre del estudio</Label>
          <Input
            id="businessName"
            name="businessName"
            defaultValue={settings.businessName}
            required
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tagline">Frase</Label>
          <Input id="tagline" name="tagline" defaultValue={settings.tagline} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="logoUrl">Logo</Label>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt=""
                width={56}
                height={56}
                className="size-14 shrink-0 rounded-xl border object-cover"
                unoptimized
              />
            ) : (
              <span className="bg-muted grid size-14 shrink-0 place-items-center rounded-xl text-xs">
                —
              </span>
            )}
            <Input
              id="logoUrl"
              name="logoUrl"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="/marca/logo-ariale.jpg"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Ruta dentro de <code>public/</code> o una URL completa.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" defaultValue={settings.phone ?? ""} inputMode="tel" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            name="whatsapp"
            defaultValue={settings.whatsapp ?? ""}
            inputMode="tel"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="instagram">Instagram</Label>
          <Input
            id="instagram"
            name="instagram"
            defaultValue={settings.instagram ?? ""}
            placeholder="@arialestudio"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Dirección</Label>
          <Input id="address" name="address" defaultValue={settings.address ?? ""} />
        </div>
      </div>

      <Feedback state={state} />

      <Button type="submit" disabled={pending} className="h-11">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Guardar
      </Button>
    </form>
  );
}

function ScheduleForm({
  settings,
  hours,
  onSaved,
}: {
  settings: Settings;
  hours: Hour[];
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveScheduleAction, null);
  const [days, setDays] = useState(hours);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onSaved();
    }
  }, [state, onSaved]);

  const update = (dayOfWeek: number, patch: Partial<Hour>) => {
    setDays((current) =>
      current.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)),
    );
  };

  // Lunes primero, como se lee un horario.
  const ordered = [...days].sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7));

  return (
    <form action={action} className="surface space-y-5 p-5">
      <div>
        <h2 className="font-semibold">Horario de atención</h2>
        <p className="text-muted-foreground text-sm">
          Las clientas solo pueden reservar dentro de estas horas.
        </p>
      </div>

      <div className="space-y-2">
        {ordered.map((day) => (
          <div
            key={day.dayOfWeek}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-xl border p-3 transition",
              !day.enabled && "bg-muted/40 opacity-70",
            )}
          >
            <input
              type="hidden"
              name={`enabled-${day.dayOfWeek}`}
              value={day.enabled ? "on" : ""}
            />
            <Switch
              checked={day.enabled}
              onCheckedChange={(checked) => update(day.dayOfWeek, { enabled: checked })}
              aria-label={DAY_NAMES[day.dayOfWeek]}
            />
            <span className="w-24 shrink-0 text-sm font-medium">{DAY_NAMES[day.dayOfWeek]}</span>

            <div className="flex flex-1 items-center gap-2">
              <Input
                type="time"
                name={`open-${day.dayOfWeek}`}
                value={day.openTime}
                onChange={(event) => update(day.dayOfWeek, { openTime: event.target.value })}
                disabled={!day.enabled}
                className="w-32"
              />
              <span className="text-muted-foreground text-sm">a</span>
              <Input
                type="time"
                name={`close-${day.dayOfWeek}`}
                value={day.closeTime}
                onChange={(event) => update(day.dayOfWeek, { closeTime: event.target.value })}
                disabled={!day.enabled}
                className="w-32"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="slotMinutes">Intervalo entre citas</Label>
          <Select name="slotMinutes" defaultValue={String(settings.slotMinutes)}>
            <SelectTrigger id="slotMinutes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 15, 20, 30, 45, 60].map((value) => (
                <SelectItem key={value} value={String(value)}>
                  Cada {value} minutos
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="minHoursAhead">Antelación mínima (horas)</Label>
          <Input
            id="minHoursAhead"
            name="minHoursAhead"
            type="number"
            min={0}
            max={72}
            defaultValue={settings.minHoursAhead}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maxDaysAhead">Se puede reservar hasta (días)</Label>
          <Input
            id="maxDaysAhead"
            name="maxDaysAhead"
            type="number"
            min={1}
            max={365}
            defaultValue={settings.maxDaysAhead}
          />
        </div>
      </div>

      <Feedback state={state} />

      <Button type="submit" disabled={pending} className="h-11">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Guardar horario
      </Button>
    </form>
  );
}

function CurrencyForm({
  settings,
  rate,
  onSaved,
}: {
  settings: Settings;
  rate: { value: number; source: string; stale: boolean };
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCurrencyAction, null);
  const [mode, setMode] = useState(settings.rateMode);
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <form action={action} className="surface space-y-5 p-5">
      <div>
        <h2 className="font-semibold">Moneda y tasa</h2>
        <p className="text-muted-foreground text-sm">
          Los montos se llevan en dólares y se muestran también en bolívares.
        </p>
      </div>

      <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
        <div>
          <p className="text-muted-foreground text-xs uppercase">Tasa de hoy</p>
          <p className="font-numeric text-2xl font-semibold tabular-nums">
            {rate.value > 0 ? `${rate.value.toFixed(2)} Bs.` : "Sin tasa"}
          </p>
          <p className="text-muted-foreground text-xs">
            Fuente: {rate.source}
            {rate.stale ? " · no se pudo actualizar hoy" : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing || mode === "MANUAL"}
          onClick={() =>
            startRefresh(async () => {
              await refreshRateAction();
              toast.success("Volvemos a consultar la tasa.");
              onSaved();
            })
          }
        >
          {refreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Actualizar
        </Button>
      </div>

      <input type="hidden" name="rateMode" value={mode} />
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          {
            value: "AUTO",
            title: "Automática",
            description: "La app consulta la tasa BCV del día por su cuenta.",
          },
          {
            value: "MANUAL",
            title: "Manual",
            description: "Tú escribes la tasa que quieres usar.",
          },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={cn(
              "rounded-xl border p-3 text-left transition",
              mode === option.value
                ? "border-primary bg-primary/8 ring-primary/25 ring-1"
                : "border-border hover:border-primary/40",
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              {mode === option.value ? <Check className="text-primary size-4" /> : null}
              {option.title}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="manualRate">Tasa manual (Bs. por USD)</Label>
          <Input
            id="manualRate"
            name="manualRate"
            inputMode="decimal"
            defaultValue={settings.manualRate || ""}
            disabled={mode !== "MANUAL"}
            placeholder="243.17"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currencyLabel">Nombre de la tasa</Label>
          <Input id="currencyLabel" name="currencyLabel" defaultValue={settings.currencyLabel} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="countryCode">Prefijo telefónico</Label>
          <Input id="countryCode" name="countryCode" defaultValue={settings.countryCode} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="timezone">Zona horaria</Label>
          <Select name="timezone" defaultValue={settings.timezone}>
            <SelectTrigger id="timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "America/Caracas",
                "America/Bogota",
                "America/Santiago",
                "America/Lima",
                "America/Panama",
                "America/Mexico_City",
                "America/Santo_Domingo",
                "Europe/Madrid",
              ].map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Feedback state={state} />

      <Button type="submit" disabled={pending} className="h-11">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Guardar
      </Button>
    </form>
  );
}

function AppearanceForm({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveAppearanceAction,
    null,
  );
  const [accent, setAccent] = useState(settings.accentColor);
  const [menu, setMenu] = useState(settings.menuColor);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <form action={action} className="surface space-y-5 p-5">
        <div>
          <h2 className="font-semibold">Colores de la app</h2>
          <p className="text-muted-foreground text-sm">
            El acento pinta botones y enlaces; el menú, la barra lateral.
          </p>
        </div>

        <input type="hidden" name="accentColor" value={accent} />
        <input type="hidden" name="menuColor" value={menu} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Color de acento</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setAccent(swatch)}
                  style={{ background: swatch }}
                  aria-label={`Acento ${swatch}`}
                  className={
                    accent === swatch
                      ? "ring-foreground size-9 rounded-full ring-2 ring-offset-2"
                      : "size-9 rounded-full"
                  }
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accent}
                onChange={(event) => setAccent(event.target.value)}
                className="size-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                aria-label="Acento personalizado"
              />
              <Input
                value={accent}
                onChange={(event) => setAccent(event.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color del menú</Label>
            <div className="flex flex-wrap gap-2">
              {MENU_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setMenu(swatch)}
                  style={{ background: swatch }}
                  aria-label={`Menú ${swatch}`}
                  className={
                    menu === swatch
                      ? "ring-foreground size-9 rounded-full ring-2 ring-offset-2"
                      : "size-9 rounded-full"
                  }
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={menu}
                onChange={(event) => setMenu(event.target.value)}
                className="size-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                aria-label="Menú personalizado"
              />
              <Input
                value={menu}
                onChange={(event) => setMenu(event.target.value)}
                className="font-mono"
              />
            </div>
          </div>
        </div>

        <Feedback state={state} />

        <Button type="submit" disabled={pending} className="h-11">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar colores
        </Button>
      </form>

      {/* Vista previa en vivo, antes de guardar */}
      <aside className="surface h-fit p-4">
        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
          Vista previa
        </p>
        <div className="overflow-hidden rounded-xl border">
          <div className="flex">
            <div className="w-24 shrink-0 p-2" style={{ background: menu }}>
              <p className="mb-2 truncate text-[0.6rem] font-semibold text-white/90">
                {settings.businessName}
              </p>
              <p
                className="mb-1 rounded px-1.5 py-1 text-[0.6rem] font-medium"
                style={{ background: accent, color: readableOn(accent) }}
              >
                Dashboard
              </p>
              <p className="px-1.5 py-1 text-[0.6rem] text-white/60">Clientas</p>
              <p className="px-1.5 py-1 text-[0.6rem] text-white/60">Ventas</p>
            </div>
            <div className="bg-background flex-1 space-y-2 p-2">
              <div className="rounded-lg p-2" style={{ background: menu }}>
                <p className="text-[0.55rem] text-white/60 uppercase">Utilidad neta</p>
                <p className="text-sm font-semibold text-white">$1.240,00</p>
              </div>
              <p
                className="w-fit rounded-md px-2 py-1 text-[0.6rem] font-medium"
                style={{ background: accent, color: readableOn(accent) }}
              >
                Nueva venta
              </p>
              <p className="text-[0.6rem]" style={{ color: accent }}>
                Ver reportes
              </p>
            </div>
          </div>
        </div>
        <div className="text-muted-foreground mt-3 flex gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{ background: accent }} />
            Acento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{ background: menu }} />
            Menú
          </span>
        </div>
      </aside>
    </div>
  );
}

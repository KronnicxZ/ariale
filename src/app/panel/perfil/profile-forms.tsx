"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound, Loader2, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordAction,
  logoutAction,
  updateProfileAction,
  type ActionState,
} from "@/actions/auth";

export function ProfileForms({
  user,
}: {
  user: { name: string; email: string; phone: string | null; role: string };
}) {
  const router = useRouter();
  const [profileState, profileAction, profilePending] = useActionState<ActionState, FormData>(
    updateProfileAction,
    null,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState<ActionState, FormData>(
    changePasswordAction,
    null,
  );

  useEffect(() => {
    if (profileState?.success) {
      toast.success(profileState.success);
      router.refresh();
    }
  }, [profileState, router]);

  useEffect(() => {
    if (passwordState?.success) toast.success(passwordState.success);
  }, [passwordState]);

  return (
    <div className="space-y-5">
      <form action={profileAction} className="bg-card space-y-4 rounded-2xl border p-5">
        <div>
          <h2 className="font-semibold">Tus datos</h2>
          <p className="text-muted-foreground text-sm">
            {user.role === "OWNER" ? "Dueña del estudio" : "Administradora"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={user.name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" defaultValue={user.email} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" name="phone" defaultValue={user.phone ?? ""} inputMode="tel" />
          </div>
        </div>

        {profileState?.error ? (
          <p className="text-destructive flex items-start gap-1.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {profileState.error}
          </p>
        ) : null}

        <Button type="submit" disabled={profilePending} className="h-11">
          {profilePending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Guardar
        </Button>
      </form>

      <form action={passwordAction} className="bg-card space-y-4 rounded-2xl border p-5">
        <div>
          <h2 className="font-semibold">Cambiar contraseña</h2>
          <p className="text-muted-foreground text-sm">Mínimo 8 caracteres.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="current">Contraseña actual</Label>
            <Input
              id="current"
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next">Nueva contraseña</Label>
            <Input id="next" name="next" type="password" autoComplete="new-password" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Repítela</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        {passwordState?.error ? (
          <p className="text-destructive flex items-start gap-1.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {passwordState.error}
          </p>
        ) : null}

        <Button type="submit" disabled={passwordPending} variant="outline" className="h-11">
          {passwordPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          Cambiar contraseña
        </Button>
      </form>

      <form action={logoutAction}>
        <Button type="submit" variant="ghost" className="text-destructive">
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}

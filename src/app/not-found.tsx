import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="soft-blush flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="bg-primary text-primary-foreground mb-5 grid size-14 place-items-center rounded-2xl">
        <Sparkles className="size-7" />
      </span>
      <h1 className="font-heading text-3xl font-semibold">Aquí no hay nada</h1>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        El enlace que abriste no existe o ya no está disponible.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/panel">Ir al panel</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/reservar">Agendar una cita</Link>
        </Button>
      </div>
    </main>
  );
}

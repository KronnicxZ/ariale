import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="soft-blush flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Image
        src="/marca/logo-ariale.png"
        alt=""
        width={140}
        height={56}
        className="mb-8 h-14 w-auto"
      />
      <h1 className="font-display text-3xl">Aquí no hay nada</h1>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        El enlace que abriste no existe o ya no está disponible.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
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

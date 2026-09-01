import Image from "next/image";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Logotipo del estudio. Se usa en las cabeceras de las tres zonas.
 *
 * El PNG es un logotipo con fondo transparente, así que se lee igual sobre
 * el crema del panel público y sobre el menú oscuro. Si el negocio todavía no
 * ha subido logo, caemos a un icono con el nombre, para que nunca quede vacío.
 */
export function BrandMark({
  logoUrl,
  name,
  height = 34,
  className,
  onDark = false,
}: {
  logoUrl?: string | null;
  name: string;
  /** Altura en píxeles del logotipo. El ancho se calcula solo. */
  height?: number;
  className?: string;
  /** Sobre fondo oscuro el texto de reserva va en claro. */
  onDark?: boolean;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={Math.round(height * 2.5)}
        height={height}
        className={cn("w-auto object-contain", className)}
        style={{ height }}
        priority
      />
    );
  }

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-full">
        <Sparkles className="size-4.5" />
      </span>
      <span
        className={cn(
          "font-display truncate text-lg font-semibold",
          onDark && "text-white",
        )}
      >
        {name}
      </span>
    </span>
  );
}

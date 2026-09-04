"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Link2, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "¿Tienes un diseño en mente?" — la clienta sube una foto de su galería o
 * pega el enlace de la que vio por ahí, y Alejandra la ve al abrir la cita.
 *
 * La foto se encoge en el propio navegador antes de subirla. Una foto de
 * teléfono son cuatro o cinco megas y no hacen falta: con 1600 píxeles de
 * lado largo se ve un diseño de uñas perfectamente, y se sube en un
 * segundo aunque haya poca señal.
 */
const LADO_MAXIMO = 1600;

async function encoger(archivo: File): Promise<File> {
  // Los formatos raros (HEIC de iPhone, por ejemplo) puede que el navegador
  // no sepa dibujarlos: en ese caso va el original y que decida el servidor.
  const bitmap = await createImageBitmap(archivo).catch(() => null);
  if (!bitmap) return archivo;

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  if (escala === 1 && archivo.size < 900_000) return archivo;

  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext("2d")?.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((listo) =>
    lienzo.toBlob(listo, "image/jpeg", 0.82),
  );
  if (!blob) return archivo;
  return new File([blob], archivo.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}

export function CampoDiseno({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlace, setEnlace] = useState("");
  const [modo, setModo] = useState<"foto" | "enlace">("foto");

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      const cuerpo = new FormData();
      cuerpo.append("archivo", await encoger(archivo));
      const respuesta = await fetch("/api/diseno", { method: "POST", body: cuerpo });
      const datos = (await respuesta.json()) as { url?: string; error?: string };
      if (!respuesta.ok || !datos.url) {
        setError(datos.error ?? "No pudimos subir la imagen.");
        return;
      }
      onChange(datos.url);
    } catch {
      setError("No pudimos subir la imagen. Revisa tu conexión.");
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-3">
        <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-xl">
          {/* `unoptimized` porque el enlace puede ser de cualquier sitio y no
              queremos que un dominio no permitido deje el hueco en blanco. */}
          <Image src={value} alt="Diseño de referencia" fill unoptimized className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Diseño adjunto</p>
          <p className="text-muted-foreground truncate text-xs">{value}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange("");
            setEnlace("");
          }}
          aria-label="Quitar el diseño"
          className="text-muted-foreground hover:bg-muted grid size-9 shrink-0 place-items-center rounded-full transition"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(
          [
            ["foto", "Subir una foto", ImagePlus],
            ["enlace", "Pegar un enlace", Link2],
          ] as const
        ).map(([id, texto, Icono]) => (
          <button
            key={id}
            type="button"
            onClick={() => setModo(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition",
              modo === id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <Icono className="size-4" />
            {texto}
          </button>
        ))}
      </div>

      {modo === "foto" ? (
        <>
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => elegir(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={subiendo}
            onClick={() => entrada.current?.click()}
            className="border-border hover:border-primary/50 text-muted-foreground flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-sm transition disabled:opacity-60"
          >
            {subiendo ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Subiendo…
              </>
            ) : (
              <>
                <ImagePlus className="size-4" />
                Elegir de mi galería
              </>
            )}
          </button>
        </>
      ) : (
        <div className="flex gap-2">
          <input
            type="url"
            inputMode="url"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder="https://…"
            className="border-border bg-card focus:border-primary h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm outline-none"
          />
          <button
            type="button"
            disabled={!enlace.trim().startsWith("http")}
            onClick={() => onChange(enlace.trim())}
            className="bg-primary text-primary-foreground h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-40"
          >
            Añadir
          </button>
        </div>
      )}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}

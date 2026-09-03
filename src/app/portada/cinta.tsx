import Image from "next/image";

/**
 * Cinta que se desliza sola, sin parar. El truco es tener el contenido dos
 * veces y mover la pista media vuelta: cuando termina la primera copia, la
 * segunda está justo donde empezó la primera, así que no se ve el corte.
 * Es CSS puro (ver `.cinta` en globals.css); se detiene al pasar el ratón y
 * no se mueve para quien pidió menos animación en su sistema.
 */
export function CintaPalabras({ palabras }: { palabras: string[] }) {
  const pista = [...palabras, ...palabras];
  return (
    <div className="noche filo-oro overflow-hidden border-y py-5">
      <div className="cinta flex w-max items-center gap-8 sm:gap-12">
        {pista.map((palabra, i) => (
          <span key={`${palabra}-${i}`} className="flex shrink-0 items-center gap-8 sm:gap-12">
            <span className="font-display oro text-2xl whitespace-nowrap sm:text-3xl lg:text-4xl">
              {palabra}
            </span>
            <span className="bg-primary/60 size-1.5 shrink-0 rounded-full" aria-hidden="true" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function CintaFotos({ fotos }: { fotos: { src: string; alt: string }[] }) {
  const pista = [...fotos, ...fotos];
  return (
    <div className="overflow-hidden">
      <div className="cinta cinta-lenta flex w-max gap-3 sm:gap-4">
        {pista.map((foto, i) => (
          <div
            key={`${foto.src}-${i}`}
            className="relative h-44 w-32 shrink-0 overflow-hidden rounded-2xl sm:h-60 sm:w-44 lg:h-72 lg:w-52"
          >
            <Image
              src={foto.src}
              alt={i < fotos.length ? foto.alt : ""}
              fill
              sizes="(min-width: 1024px) 208px, (min-width: 640px) 176px, 128px"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

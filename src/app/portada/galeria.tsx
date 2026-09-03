"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type Foto = { src: string; alt: string };

/**
 * El trabajo real: cuadrícula en pantalla ancha, carrusel que se desliza en
 * el teléfono, y cualquier foto se abre a pantalla completa con flechas.
 */
export function Galeria({ fotos }: { fotos: Foto[] }) {
  const [abierta, setAbierta] = useState<number | null>(null);

  const cerrar = useCallback(() => setAbierta(null), []);
  const mover = useCallback(
    (paso: number) =>
      setAbierta((i) => (i === null ? null : (i + paso + fotos.length) % fotos.length)),
    [fotos.length],
  );

  // Teclado: Esc cierra, flechas navegan. Y mientras está abierta, la
  // página de atrás no se desplaza.
  useEffect(() => {
    if (abierta === null) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };
    window.addEventListener("keydown", alPulsar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = overflow;
    };
  }, [abierta, cerrar, mover]);

  return (
    <>
      {/* Teléfono: carrusel con freno en cada foto. */}
      <div className="no-scrollbar snap-row -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 sm:hidden">
        {fotos.map((foto, i) => (
          <button
            key={foto.src}
            type="button"
            onClick={() => setAbierta(i)}
            className="relative aspect-[3/4] w-[68vw] shrink-0 overflow-hidden rounded-2xl"
          >
            <Image
              src={foto.src}
              alt={foto.alt}
              fill
              sizes="68vw"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {/* Pantalla ancha: cuadrícula. */}
      <div className="hidden gap-4 sm:grid sm:grid-cols-3 lg:gap-5">
        {fotos.map((foto, i) => (
          <button
            key={foto.src}
            type="button"
            onClick={() => setAbierta(i)}
            className="group relative aspect-[3/4] overflow-hidden rounded-2xl"
          >
            <Image
              src={foto.src}
              alt={foto.alt}
              fill
              sizes="33vw"
              className="object-cover transition duration-700 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-black/0 transition duration-500 group-hover:bg-black/15" />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {abierta !== null ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={cerrar}
            role="dialog"
            aria-modal="true"
            aria-label={fotos[abierta].alt}
          >
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="absolute top-4 right-4 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="size-5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                mover(-1);
              }}
              aria-label="Anterior"
              className="absolute left-3 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                mover(1);
              }}
              aria-label="Siguiente"
              className="absolute right-3 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
            >
              <ChevronRight className="size-5" />
            </button>

            <motion.div
              key={fotos[abierta].src}
              className="relative h-[76vh] w-full max-w-3xl"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={fotos[abierta].src}
                alt={fotos[abierta].alt}
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-contain"
                priority
              />
            </motion.div>

            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-xs text-white/70">
              {fotos[abierta].alt} · {abierta + 1} de {fotos.length}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

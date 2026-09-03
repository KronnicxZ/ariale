"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";

export type AreaServicio = {
  id: string;
  nombre: string;
  descripcion: string;
  foto: string;
  servicios: { id: string; nombre: string; duracion: string; precio: string }[];
};

/**
 * Los servicios contados al bajar: en pantalla ancha la foto se queda fija y
 * va cambiando según el área que estés leyendo. En el teléfono, cada área es
 * su propia tarjeta con su foto, que es como se lee bien en vertical.
 */
export function Servicios({ areas }: { areas: AreaServicio[] }) {
  const [activa, setActiva] = useState(0);
  const bloques = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        // La que más superficie tenga en la franja central manda.
        const visible = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const i = bloques.current.indexOf(visible.target as HTMLDivElement);
        if (i >= 0) setActiva(i);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.5, 1] },
    );
    for (const el of bloques.current) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [areas.length]);

  return (
    <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:gap-16">
      {/* Foto fija que va cambiando. Solo en pantalla ancha. */}
      <div className="hidden lg:block">
        <div className="sticky top-24 aspect-[4/5] overflow-hidden rounded-3xl">
          <AnimatePresence initial={false}>
            <motion.div
              key={areas[activa]?.id}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Image
                src={areas[activa]?.foto ?? ""}
                alt=""
                fill
                sizes="50vw"
                className="object-cover"
              />
            </motion.div>
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <p className="font-display absolute bottom-6 left-7 text-3xl text-white">
            {areas[activa]?.nombre}
          </p>
        </div>
      </div>

      <div className="space-y-16 lg:space-y-32">
        {areas.map((area, i) => (
          <div
            key={area.id}
            ref={(el) => {
              bloques.current[i] = el;
            }}
          >
            {/* En el teléfono cada área trae su propia foto. */}
            <div className="relative mb-6 aspect-[3/2] overflow-hidden rounded-3xl lg:hidden">
              <Image src={area.foto} alt="" fill sizes="100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <p className="font-display absolute bottom-5 left-5 text-3xl text-white">
                {area.nombre}
              </p>
            </div>

            <p className="label-caps oro hidden lg:block">0{i + 1}</p>
            <h3 className="font-display mt-2 hidden text-4xl lg:block">{area.nombre}</h3>
            <p className="text-muted-foreground mt-3 text-base text-balance lg:text-lg">
              {area.descripcion}
            </p>

            <ul className="border-border/70 mt-7 divide-y">
              {area.servicios.map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-4 py-3.5">
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium">{s.nombre}</span>
                    <span className="text-muted-foreground text-xs">{s.duracion}</span>
                  </span>
                  <span className="font-numeric shrink-0 text-[15px]">{s.precio}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

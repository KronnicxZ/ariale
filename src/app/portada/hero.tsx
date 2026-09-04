"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { CalendarPlus, ChevronDown } from "lucide-react";

/**
 * La primera pantalla. La foto del estudio respira detrás, y encima la marca
 * va apareciendo por partes: primero el rótulo, luego el logotipo, después el
 * filo dorado que se abre, y al final el lema y el botón.
 *
 * El orden importa: si todo entra a la vez no es una entrada, es un parpadeo.
 */
export function Hero({
  negocio,
  lema,
  rotulo,
}: {
  negocio: string;
  lema: string;
  rotulo: string;
}) {
  // Cada pieza entra un poco después que la anterior. En un componente
  // servidor esto no se puede: por eso el hero es cliente.
  const sube = (retraso: number) => ({
    initial: { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay: retraso, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section className="relative flex min-h-dvh items-center overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/trabajos/estudio-ambiente.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          // En vertical el centro de la foto es la cortina negra: se corre un
          // poco a la derecha para que se vea el puesto de trabajo.
          className="respira object-cover object-[62%_center] sm:object-center"
        />
      </div>

      {/* Tres velos: uno parejo que baja el brillo, otro vertical que hunde
          los extremos, y el halo dorado que despega la marca del fondo. */}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/90" />
      <div className="aura-oro absolute inset-0" />

      {/* Marco fino, como el filo de una portada de revista. */}
      <div className="pointer-events-none absolute inset-4 hidden rounded-[2rem] border border-white/12 sm:block lg:inset-7" />

      <div className="relative z-10 mx-auto w-full max-w-4xl px-5 py-24 text-center text-white">
        {/* Más pequeño en el teléfono: a 12px la línea entera va de borde a
            borde y se lee apretada. */}
        <motion.p {...sube(0)} className="label-caps text-primary/90 text-[10px] sm:text-xs">
          {rotulo}
        </motion.p>

        {/* Su logotipo de verdad, no una versión redibujada. El archivo es de
            1000×400, así que a esta altura se ve nítido incluso en pantallas
            de alta densidad. */}
        <h1 className="sr-only">{negocio}</h1>
        <motion.div {...sube(0.12)}>
          <Image
            src="/marca/logo-ariale.png"
            alt={negocio}
            width={1000}
            height={400}
            priority
            sizes="(min-width: 1024px) 460px, (min-width: 640px) 380px, 290px"
            className="mx-auto mt-6 h-auto w-72 drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)] sm:w-95 lg:w-115"
          />
        </motion.div>

        {/* El filo se abre en vez de aparecer: es el gesto que hace que la
            marca se sienta presentada y no pegada. */}
        <motion.span
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 1.1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="via-primary mx-auto mt-8 block h-px w-40 bg-gradient-to-r from-transparent to-transparent sm:w-56"
        />

        <motion.p
          {...sube(0.42)}
          className="mx-auto mt-8 max-w-xl text-lg text-balance text-white/80 sm:text-xl"
        >
          {lema}
        </motion.p>

        <motion.div {...sube(0.58)} className="mt-10">
          <Link
            href="/reservar"
            className="brand-gradient text-primary-foreground inline-flex items-center justify-center gap-2.5 rounded-full px-9 py-4 text-base font-semibold shadow-[0_10px_40px_-8px] shadow-black/60 transition hover:brightness-105 active:scale-[0.99]"
          >
            <CalendarPlus className="size-5" />
            Agendar mi cita
          </Link>
        </motion.div>
      </div>

      {/* Que se note que hay más abajo. Se esconde en el teléfono, donde la
          barra fija ya ocupa ese borde. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.3 }}
        className="absolute inset-x-0 bottom-8 z-10 hidden justify-center sm:flex"
      >
        <ChevronDown className="baja-suave size-6 text-white/60" />
      </motion.div>
    </section>
  );
}

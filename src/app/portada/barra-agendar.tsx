"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarPlus } from "lucide-react";

/**
 * La barra de abajo en el teléfono, para no tener que volver a subir.
 *
 * Aparece solo cuando el hero ya quedó atrás: mientras se ve el hero, su
 * propio botón ya dice "Agendar mi cita", y tener los dos a la vez en la
 * misma pantalla no ayudaba a nadie.
 */
export function BarraAgendar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mirar = () => setVisible(window.scrollY > window.innerHeight * 0.85);
    mirar();
    window.addEventListener("scroll", mirar, { passive: true });
    return () => window.removeEventListener("scroll", mirar);
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ y: 90 }}
          animate={{ y: 0 }}
          exit={{ y: 90 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="bg-card/95 safe-bottom fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden"
        >
          <Link
            href="/reservar"
            className="brand-gradient text-primary-foreground flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold"
          >
            <CalendarPlus className="size-5" />
            Agendar mi cita
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

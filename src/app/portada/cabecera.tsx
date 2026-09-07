"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";

const ENLACES = [
  { texto: "Servicios", ancla: "#servicios" },
  { texto: "Trabajos", ancla: "#trabajos" },
  { texto: "Nosotras", ancla: "#nosotras" },
  { texto: "Contacto", ancla: "#contacto" },
];

/**
 * La barra de arriba.
 *
 * No está sobre el hero —ahí taparía la foto, que es lo que manda en la
 * primera pantalla— sino que baja cuando se ha pasado de largo. Desde el
 * final de la página, que es donde se acaba leyendo, no había forma de
 * volver a los servicios ni de agendar sin arrastrar hasta arriba.
 */
export function Cabecera({ negocio }: { negocio: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const alDesplazar = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    alDesplazar();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => window.removeEventListener("scroll", alDesplazar);
  }, []);

  return (
    <header
      className={`border-border/60 bg-background/85 fixed inset-x-0 top-0 z-40 border-b backdrop-blur transition duration-300 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-5 px-5 py-3">
        <a href="#inicio" className="flex items-center gap-2.5">
          <Image
            src="/marca/flor-ariale.png"
            alt=""
            width={64}
            height={64}
            className="size-8 object-contain"
          />
          <span className="font-display text-lg">{negocio}</span>
        </a>

        <nav className="ml-auto hidden items-center gap-1 text-sm lg:flex">
          {ENLACES.map((e) => (
            <a
              key={e.ancla}
              href={e.ancla}
              className="text-muted-foreground hover:text-foreground rounded-full px-3 py-2 transition"
            >
              {e.texto}
            </a>
          ))}
        </nav>

        {/* En el teléfono la barra fija de abajo ya lleva "Agendar": aquí
            arriba sobraría y le quitaría sitio al nombre. */}
        <Link
          href="/reservar"
          className="brand-gradient text-primary-foreground ml-auto hidden items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow transition hover:brightness-105 sm:inline-flex lg:ml-0"
        >
          <CalendarPlus className="size-4" />
          Agendar
        </Link>
      </div>
    </header>
  );
}

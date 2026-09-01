"use client";

import { useSyncExternalStore } from "react";

/**
 * Marca de tiempo que avanza sola, sin efectos ni renders en cascada.
 * En el servidor devuelve null, así que no hay desajuste de hidratación.
 */
export function useClock(intervalMs = 1000): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const timer = setInterval(onChange, intervalMs);
      return () => clearInterval(timer);
    },
    // Redondeamos al intervalo para que la instantánea sea estable entre
    // renders del mismo tic.
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
}

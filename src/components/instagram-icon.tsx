/**
 * El glifo de Instagram, dibujado a mano.
 *
 * Lucide dejó de traer marcas, y el resto de la página usa el mismo truco
 * para WhatsApp: un solo trazo que hereda el color del texto, para que se
 * lea igual de bien sobre claro que sobre el negro del cierre.
 */
export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" />
    </svg>
  );
}

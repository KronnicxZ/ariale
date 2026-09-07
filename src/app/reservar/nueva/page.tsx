import { permanentRedirect } from "next/navigation";

/**
 * Aquí vivía el asistente. Ahora vive en "/reservar", que es donde llega
 * quien pulsa "Agendar" en la portada, y esta dirección solo redirige: hay
 * enlaces sueltos por ahí —mensajes de WhatsApp, marcadores— que apuntan a
 * ella y no tienen por qué romperse.
 */
export default function ReservarNuevaPage(): never {
  permanentRedirect("/reservar");
}

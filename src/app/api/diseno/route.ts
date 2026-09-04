import { put } from "@vercel/blob";
import { getCurrentClient } from "@/lib/auth";

/**
 * Sube la foto del diseño que la clienta quiere, desde el paso de la nota al
 * agendar. Devuelve la dirección pública para guardarla junto a la cita.
 *
 * La imagen llega ya reducida desde el navegador (ver `campo-diseno.tsx`):
 * una foto de teléfono son cuatro o cinco megas y aquí no caben, así que se
 * encoge antes de salir. Este tope es la red de seguridad, no el plan.
 */
const MAXIMO = 4 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function POST(request: Request) {
  // Solo una clienta identificada sube archivos: si no, esto sería un
  // depósito abierto a internet.
  const client = await getCurrentClient();
  if (!client) {
    return Response.json({ error: "Vuelve a entrar con tu número." }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "Todavía no podemos recibir fotos. Pega el enlace de la imagen." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) {
    return Response.json({ error: "No llegó ninguna imagen." }, { status: 400 });
  }
  if (!TIPOS.includes(archivo.type)) {
    return Response.json({ error: "Tiene que ser una imagen." }, { status: 400 });
  }
  if (archivo.size > MAXIMO) {
    return Response.json({ error: "La imagen pesa demasiado." }, { status: 400 });
  }

  try {
    // `addRandomSuffix` evita que dos clientas que suben "IMG_1234.jpg" se
    // pisen la foto la una a la otra.
    const subida = await put(`disenos/${client.id}/${archivo.name}`, archivo, {
      access: "public",
      addRandomSuffix: true,
      contentType: archivo.type,
    });
    return Response.json({ url: subida.url });
  } catch (error) {
    console.error("[diseno] no se pudo subir la imagen", error);
    return Response.json(
      { error: "No pudimos guardar la imagen. Prueba con el enlace." },
      { status: 500 },
    );
  }
}

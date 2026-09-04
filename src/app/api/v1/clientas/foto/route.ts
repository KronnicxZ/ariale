import { put } from "@vercel/blob";
import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/utils";

/**
 * Guarda la foto de una clienta, la que traía su ficha en la agenda del
 * teléfono. Va por teléfono y no por id: es el dato que la app tiene a mano
 * tanto al importar como al volver a sincronizar.
 *
 * Una por petición a propósito. Las miniaturas de la agenda son pequeñas,
 * pero quinientas en un solo envío no caben; así además se puede enseñar el
 * avance y, si se corta a la mitad, lo subido se queda subido.
 */
const MAXIMO = 2 * 1024 * 1024;

export const POST = withUser(async ({ request }) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Todavía no se pueden guardar fotos. Falta configurar el almacén.");
  }

  const form = await request.formData();
  const telefono = normalizePhone(String(form.get("telefono") ?? ""));
  const archivo = form.get("archivo");

  if (telefono.length < 10) throw new Error("Falta el teléfono de la clienta.");
  if (!(archivo instanceof File)) throw new Error("No llegó ninguna imagen.");
  if (!archivo.type.startsWith("image/")) throw new Error("Tiene que ser una imagen.");
  if (archivo.size > MAXIMO) throw new Error("La imagen pesa demasiado.");

  const cliente = await prisma.client.findUnique({
    where: { phone: telefono },
    select: { id: true },
  });
  if (!cliente) throw new Error("Esa clienta no está en la lista.");

  const subida = await put(`clientas/${cliente.id}.jpg`, archivo, {
    access: "public",
    // Con la ruta fija, volver a sincronizar reemplaza la foto anterior en
    // vez de dejar la vieja colgando en el almacén para siempre.
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: archivo.type,
  });

  // La ruta es fija, así que la dirección no cambia al reemplazar la foto y
  // el navegador seguiría enseñando la vieja. El sello la despega de la
  // caché sin ensuciar el almacén con un archivo nuevo cada vez.
  const foto = `${subida.url}?v=${Date.now()}`;

  await prisma.client.update({
    where: { id: cliente.id },
    data: { avatarUrl: foto },
  });

  return { id: cliente.id, foto };
});

export { OPTIONS } from "@/lib/api";

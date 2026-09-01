import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/panel/page-header";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { deleteClientAction } from "@/actions/clients";
import { ClientForm } from "../../client-form";

export const metadata = { title: "Editar clienta" };

export default async function EditClientPage(props: PageProps<"/panel/clientes/[id]/editar">) {
  const { id } = await props.params;
  const [client, settings] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    getSettings(),
  ]);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href={`/panel/clientes/${id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition"
      >
        <ArrowLeft className="size-4" />
        Volver a la ficha
      </Link>

      <PageHeader title="Editar clienta" description={client.name} />
      <ClientForm client={client} countryCode={settings.countryCode} />

      <form action={deleteClientAction} className="border-destructive/25 rounded-2xl border p-5">
        <input type="hidden" name="id" value={client.id} />
        <h2 className="font-semibold">Eliminar del directorio</h2>
        <p className="text-muted-foreground mt-1 mb-3 text-sm">
          Si tiene ventas registradas no se borra: se desactiva para conservar el historial
          contable.
        </p>
        <Button type="submit" variant="outline" className="text-destructive">
          <Trash2 className="size-4" />
          Eliminar clienta
        </Button>
      </form>
    </div>
  );
}

import { PageHeader } from "@/components/panel/page-header";
import { getSettings } from "@/lib/settings";
import { ClientForm } from "../client-form";

export const metadata = { title: "Nueva clienta" };

export default async function NewClientPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Nueva clienta"
        description="Con el nombre y el teléfono basta para empezar."
      />
      <ClientForm countryCode={settings.countryCode} />
    </div>
  );
}

import { PageHeader } from "@/components/panel/page-header";
import { prisma } from "@/lib/db";
import { dayKey } from "@/lib/date";
import { getSettings } from "@/lib/settings";
import { PurchaseForm } from "../purchase-form";

export const metadata = { title: "Nueva compra" };

export default async function NewPurchasePage() {
  const [suppliers, settings] = await Promise.all([
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Nueva compra" description="Insumos y mercancía." />
      <PurchaseForm suppliers={suppliers} today={dayKey(new Date(), settings.timezone)} />
    </div>
  );
}

import { PageHeader } from "@/components/panel/page-header";
import { prisma } from "@/lib/db";
import { dayKey } from "@/lib/date";
import { getSettings } from "@/lib/settings";
import { ExpenseForm } from "../expense-form";

export const metadata = { title: "Nuevo gasto" };

export default async function NewExpensePage() {
  const [categories, settings] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Nuevo gasto" description="Todo lo que sale de caja." />
      <ExpenseForm categories={categories} today={dayKey(new Date(), settings.timezone)} />
    </div>
  );
}

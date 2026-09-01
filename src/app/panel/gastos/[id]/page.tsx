import { notFound } from "next/navigation";
import { PageHeader } from "@/components/panel/page-header";
import { prisma } from "@/lib/db";
import { dayKey } from "@/lib/date";
import { getSettings } from "@/lib/settings";
import { ExpenseForm } from "../expense-form";

export const metadata = { title: "Editar gasto" };

export default async function EditExpensePage(props: PageProps<"/panel/gastos/[id]">) {
  const { id } = await props.params;
  const [expense, categories, settings] = await Promise.all([
    prisma.expense.findUnique({ where: { id } }),
    prisma.expenseCategory.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  if (!expense) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Editar gasto" description={expense.description} />
      <ExpenseForm
        expense={expense}
        categories={categories}
        today={dayKey(new Date(), settings.timezone)}
      />
    </div>
  );
}

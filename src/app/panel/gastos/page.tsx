import Link from "next/link";
import { Wallet, WalletMinimal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { PageHeader, EmptyState } from "@/components/panel/page-header";
import { PeriodFilter } from "@/components/panel/period-filter";
import { StatCard } from "@/components/panel/stat-card";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/date";
import { PAYMENT_METHOD_LABELS, formatUsd, ratio } from "@/lib/money";
import { getRate } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { periodFromParams, stringParam } from "@/lib/period";
import { deleteExpenseAction } from "@/actions/finance";
import { ExpenseCategoryFilter } from "./category-filter";

export const metadata = { title: "Gastos" };

export default async function ExpensesPage(props: PageProps<"/panel/gastos">) {
  const params = await props.searchParams;
  const settings = await getSettings();
  const { period, preset, from, to } = periodFromParams(params, "last30", settings.timezone);
  const categoryId = stringParam(params, "categoria");

  const [expenses, categories, rateInfo] = await Promise.all([
    prisma.expense.findMany({
      where: {
        date: { gte: period.from, lte: period.to },
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: { date: "desc" },
      include: {
        category: { select: { id: true, name: true, color: true } },
        user: { select: { name: true } },
      },
    }),
    prisma.expenseCategory.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getRate(),
  ]);

  const totalCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const averageCents = expenses.length > 0 ? Math.round(totalCents / expenses.length) : 0;

  const byCategory = new Map<string, { name: string; color: string; totalCents: number }>();
  for (const expense of expenses) {
    const key = expense.category?.id ?? "sin";
    const entry = byCategory.get(key) ?? {
      name: expense.category?.name ?? "Sin categoría",
      color: expense.category?.color ?? "#999999",
      totalCents: 0,
    };
    entry.totalCents += expense.amountCents;
    byCategory.set(key, entry);
  }
  const categoryRows = [...byCategory.values()].sort((a, b) => b.totalCents - a.totalCents);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gastos"
        description="Egresos operativos del estudio"
        actions={
          <Button asChild size="sm">
            <Link href="/panel/gastos/nuevo">
              <Wallet className="size-4" />
              Nuevo gasto
            </Link>
          </Button>
        }
      />

      <PeriodFilter current={preset} from={from} to={to} />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Gastos"
          value={<Money cents={totalCents} rate={rateInfo.rate} />}
          hint={`${expenses.length} ${expenses.length === 1 ? "movimiento" : "movimientos"}`}
        />
        <StatCard
          featured
          label="Promedio"
          value={<Money cents={averageCents} rate={rateInfo.rate} bsClassName="text-white/60" />}
          hint="Por gasto en el periodo"
        />
      </div>

      <ExpenseCategoryFilter categories={categories} current={categoryId} />

      {categoryRows.length > 1 ? (
        <div className="surface p-4">
          <h2 className="mb-3 text-sm font-semibold">En qué se va el dinero</h2>
          <div className="space-y-2.5">
            {categoryRows.map((row) => (
              <div key={row.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: row.color }} />
                    {row.name}
                  </span>
                  <span className="font-medium tabular-nums">{formatUsd(row.totalCents)}</span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${ratio(row.totalCents, totalCents)}%`,
                      background: row.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {expenses.length === 0 ? (
        <EmptyState
          icon={<WalletMinimal className="size-8" />}
          title="No hay gastos en este periodo"
          description="Registra alquiler, insumos, publicidad y todo lo que sale de caja."
          action={
            <Button asChild size="sm">
              <Link href="/panel/gastos/nuevo">
                <Wallet className="size-4" />
                Nuevo gasto
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="surface overflow-hidden">
          <ul className="divide-y">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: expense.category?.color ?? "#999999" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{expense.description}</p>
                  <p className="text-muted-foreground text-xs">
                    {fmtDate(expense.date, settings.timezone)} ·{" "}
                    {expense.category?.name ?? "Sin categoría"} ·{" "}
                    {PAYMENT_METHOD_LABELS[expense.method] ?? expense.method}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatUsd(expense.amountCents)}
                </span>
                <Link
                  href={`/panel/gastos/${expense.id}`}
                  className="text-primary shrink-0 text-xs font-medium hover:underline"
                >
                  Editar
                </Link>
                <form action={deleteExpenseAction} className="shrink-0">
                  <input type="hidden" name="id" value={expense.id} />
                  <button
                    type="submit"
                    className="text-muted-foreground hover:text-destructive text-xs transition"
                  >
                    Borrar
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <div className="bg-muted/40 flex items-center justify-between px-4 py-2.5 text-sm font-medium">
            <span>Total del periodo</span>
            <span className="tabular-nums">{formatUsd(totalCents)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function ExpenseCategoryFilter({
  categories,
  current,
}: {
  categories: { id: string; name: string; color: string }[];
  current?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("categoria", value);
    else next.delete("categoria");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  if (categories.length === 0) return null;

  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
      <button
        type="button"
        onClick={() => set()}
        className={cn(
          "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
          !current
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground hover:bg-accent",
        )}
      >
        Todas las categorías
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => set(category.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
            current === category.id
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent",
          )}
        >
          <span className="size-2 rounded-full" style={{ background: category.color }} />
          {category.name}
        </button>
      ))}
    </div>
  );
}

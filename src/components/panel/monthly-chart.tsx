"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUsd } from "@/lib/money";

type Point = {
  month: string;
  label: string;
  ventas: number;
  cobrado: number;
  costos: number;
  utilidad: number;
};

const LABELS: Record<string, string> = {
  ventasUsd: "Ventas",
  costosUsd: "Costos",
  utilidadUsd: "Utilidad",
};

export function MonthlyChart({ data }: { data: Point[] }) {
  const points = data.map((entry) => ({
    ...entry,
    ventasUsd: entry.ventas / 100,
    costosUsd: entry.costos / 100,
    utilidadUsd: entry.utilidad / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(value: number) =>
            Math.abs(value) >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`
          }
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            fontSize: 12,
            boxShadow: "0 8px 24px rgb(0 0 0 / 0.08)",
          }}
          formatter={(value, name) => [
            formatUsd(Math.round(Number(value) * 100)),
            LABELS[String(name)] ?? String(name),
          ]}
        />
        <Bar
          dataKey="ventasUsd"
          fill="var(--chart-1)"
          radius={[6, 6, 0, 0]}
          maxBarSize={36}
          isAnimationActive={false}
        />
        <Bar
          dataKey="costosUsd"
          fill="var(--chart-2)"
          radius={[6, 6, 0, 0]}
          maxBarSize={36}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="utilidadUsd"
          stroke="var(--chart-5)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "var(--chart-5)" }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Barras horizontales simples, para rankings. */
export function RankBars({
  data,
  maxCents,
}: {
  data: { name: string; color: string; totalCents: number; quantity?: number }[];
  maxCents: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 34, 80)}>
      <BarChart
        data={data.map((d) => ({ ...d, usd: d.totalCents / 100 }))}
        layout="vertical"
        margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
      >
        <XAxis type="number" hide domain={[0, maxCents / 100]} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            fontSize: 12,
          }}
          formatter={(value) => [formatUsd(Math.round(Number(value) * 100)), "Total"]}
        />
        <Bar
          dataKey="usd"
          fill="var(--chart-1)"
          radius={[0, 6, 6, 0]}
          maxBarSize={20}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

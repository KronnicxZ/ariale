"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUsd } from "@/lib/money";
import { fmtDayShort } from "@/lib/date";

type Point = { day: string; ventas: number; cobrado: number };

export function SalesChart({ data }: { data: Point[] }) {
  const points = data.map((d) => ({
    ...d,
    ventasUsd: d.ventas / 100,
    cobradoUsd: d.cobrado / 100,
  }));

  // Con muchos días, etiquetamos solo algunos para que no se amontonen.
  const step = Math.max(1, Math.ceil(points.length / 7));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillCobrado" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={step - 1}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(value: string) => fmtDayShort(`${value}T12:00:00Z`)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(value: number) =>
            value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`
          }
        />
        <Tooltip
          cursor={{ stroke: "var(--border)" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            fontSize: 12,
            boxShadow: "0 8px 24px rgb(0 0 0 / 0.08)",
          }}
          labelFormatter={(value) => fmtDayShort(`${value}T12:00:00Z`)}
          formatter={(value, name) => [
            formatUsd(Math.round(Number(value) * 100)),
            name === "ventasUsd" ? "Ventas" : "Cobrado",
          ]}
        />
        <Area
          type="monotone"
          dataKey="ventasUsd"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#fillVentas)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="cobradoUsd"
          stroke="var(--chart-5)"
          strokeWidth={2}
          fill="url(#fillCobrado)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

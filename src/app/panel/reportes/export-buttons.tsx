"use client";

import { FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/money";

type ClientRow = {
  name: string;
  phone: string;
  count: number;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
};

type ServiceRow = { name: string; category: string; quantity: number; totalCents: number };
type SpecialistRow = { name: string; count: number; totalCents: number };

/** Comillas dobles y separador de Excel en español. */
function csvCell(value: string | number) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function money(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ExportButtons({
  period,
  clients,
  services,
  specialists,
  kpis,
  businessName,
}: {
  period: string;
  clients: ClientRow[];
  services: ServiceRow[];
  specialists: SpecialistRow[];
  kpis: { ventas: number; cobrado: number; costos: number; utilidad: number; margen: number };
  businessName: string;
}) {
  const downloadCsv = () => {
    const lines: string[] = [];

    lines.push(csvCell(`${businessName} — Reporte ${period}`));
    lines.push("");
    lines.push(["Concepto", "Monto USD"].map(csvCell).join(";"));
    lines.push([csvCell("Ventas"), csvCell(money(kpis.ventas))].join(";"));
    lines.push([csvCell("Cobrado"), csvCell(money(kpis.cobrado))].join(";"));
    lines.push([csvCell("Costos"), csvCell(money(kpis.costos))].join(";"));
    lines.push([csvCell("Utilidad neta"), csvCell(money(kpis.utilidad))].join(";"));
    lines.push([csvCell("Margen %"), csvCell(kpis.margen.toFixed(1).replace(".", ","))].join(";"));

    lines.push("");
    lines.push(csvCell("VENTAS POR CLIENTA"));
    lines.push(
      ["Clienta", "Teléfono", "Ventas", "Facturado", "Cobrado", "Pendiente"]
        .map(csvCell)
        .join(";"),
    );
    for (const row of clients) {
      lines.push(
        [
          csvCell(row.name),
          csvCell(row.phone),
          csvCell(row.count),
          csvCell(money(row.totalCents)),
          csvCell(money(row.paidCents)),
          csvCell(money(row.pendingCents)),
        ].join(";"),
      );
    }

    lines.push("");
    lines.push(csvCell("VENTAS POR SERVICIO"));
    lines.push(["Servicio", "Categoría", "Cantidad", "Total"].map(csvCell).join(";"));
    for (const row of services) {
      lines.push(
        [
          csvCell(row.name),
          csvCell(row.category),
          csvCell(row.quantity),
          csvCell(money(row.totalCents)),
        ].join(";"),
      );
    }

    lines.push("");
    lines.push(csvCell("VENTAS POR ESPECIALISTA"));
    lines.push(["Especialista", "Ventas", "Total"].map(csvCell).join(";"));
    for (const row of specialists) {
      lines.push(
        [csvCell(row.name), csvCell(row.count), csvCell(money(row.totalCents))].join(";"),
      );
    }

    // El BOM hace que Excel abra los acentos correctamente.
    const blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-${period.toLowerCase().replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={downloadCsv}>
        <FileSpreadsheet className="size-4" />
        Excel
      </Button>
      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="size-4" />
        PDF
      </Button>
      <span className="sr-only">
        Total facturado del periodo: {formatUsd(kpis.ventas)}
      </span>
    </>
  );
}

import { periodParam, withUser } from "@/lib/api";
import { getCategoryBreakdown, getDashboard, getSalesSeries } from "@/data/dashboard";
import {
  getMonthlySummary,
  getSalesByClient,
  getSalesByService,
  getSalesBySpecialist,
} from "@/data/reports";

/** Todo lo que se ve en la pestaña de reportes, en una sola llamada. */
export const GET = withUser(async ({ request }) => {
  const { period, preset } = periodParam(request, "last30");

  const [panel, serie, categorias, porClienta, porServicio, porEspecialista, meses] =
    await Promise.all([
      getDashboard(period),
      getSalesSeries(period),
      getCategoryBreakdown(period),
      getSalesByClient(period),
      getSalesByService(period),
      getSalesBySpecialist(period),
      getMonthlySummary(6),
    ]);

  const k = panel.kpis;

  return {
    periodo: { atajo: preset, etiqueta: period.label },
    kpis: {
      ventasCentavos: k.salesCents,
      ventas: k.salesCount,
      clientasAtendidas: k.clientsServed,
      cobradoCentavos: k.collectedCents,
      gastosCentavos: k.expensesCents,
      comprasCentavos: k.purchasesCents,
      costosCentavos: k.costsCents,
      gananciaCentavos: k.netProfitCents,
      margenPct: k.marginPct,
      cajaCentavos: k.cashFlowCents,
      cobranzaPct: k.collectionRatePct,
      ticketCentavos: k.ticketAvgCents,
    },
    variacion: {
      ventas: panel.deltas.sales,
      ganancia: panel.deltas.profit,
      cobrado: panel.deltas.collected,
      costos: panel.deltas.costs,
    },
    cartera: {
      porCobrarCentavos: panel.portfolio.receivableCents,
      porPagarCentavos: panel.portfolio.payableCents,
      vencidas: panel.portfolio.overdueCount,
    },
    serie: serie.map((punto) => ({
      dia: punto.day,
      ventasCentavos: punto.ventas,
      cobradoCentavos: punto.cobrado,
    })),
    categorias: categorias.map((c) => ({
      nombre: c.name,
      color: c.color,
      totalCentavos: c.totalCents,
    })),
    meses: meses.map((m) => ({
      mes: m.month,
      etiqueta: m.label,
      ventasCentavos: m.ventas,
      cobradoCentavos: m.cobrado,
      costosCentavos: m.costos,
    })),
    porClienta: porClienta.slice(0, 20).map((c) => ({
      id: c.id,
      nombre: c.name,
      telefono: c.phone,
      ventas: c.count,
      totalCentavos: c.totalCents,
      pendienteCentavos: c.pendingCents,
    })),
    porServicio: porServicio.slice(0, 20).map((s) => ({
      nombre: s.name,
      categoria: s.category,
      color: s.color,
      cantidad: s.quantity,
      totalCentavos: s.totalCents,
    })),
    porEspecialista: porEspecialista.map((e) => ({
      nombre: e.name,
      color: e.color,
      ventas: e.count,
      totalCentavos: e.totalCents,
    })),
  };
});

export { OPTIONS } from "@/lib/api";

import { PageHeader } from "@/components/panel/page-header";
import { getSettings, getWorkingHours } from "@/lib/settings";
import { getRate } from "@/lib/rate";
import { BusinessSettings } from "./business-settings";

export const metadata = { title: "Mi negocio" };

export default async function BusinessPage() {
  const [settings, hours, rateInfo] = await Promise.all([
    getSettings(),
    getWorkingHours(),
    getRate(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mi negocio"
        description="Cómo te ven las clientas, cuándo atiendes y cómo se ve tu panel"
      />
      <BusinessSettings
        settings={{
          businessName: settings.businessName,
          tagline: settings.tagline,
          logoUrl: settings.logoUrl,
          phone: settings.phone,
          whatsapp: settings.whatsapp,
          instagram: settings.instagram,
          address: settings.address,
          slotMinutes: settings.slotMinutes,
          minHoursAhead: settings.minHoursAhead,
          maxDaysAhead: settings.maxDaysAhead,
          currencyLabel: settings.currencyLabel,
          rateMode: settings.rateMode,
          manualRate: settings.manualRate,
          countryCode: settings.countryCode,
          timezone: settings.timezone,
          accentColor: settings.accentColor,
          menuColor: settings.menuColor,
        }}
        hours={hours.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          enabled: h.enabled,
          openTime: h.openTime,
          closeTime: h.closeTime,
        }))}
        rate={{ value: rateInfo.rate, source: rateInfo.source, stale: rateInfo.stale }}
      />
    </div>
  );
}

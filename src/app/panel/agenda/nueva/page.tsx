import { PageHeader } from "@/components/panel/page-header";
import { getBookingOptions, getClientOptions } from "@/data/booking";
import { getRate } from "@/lib/rate";
import { NewAppointment } from "./new-appointment";

export const metadata = { title: "Nueva cita" };

export default async function NewAppointmentPage() {
  const [{ settings, services, specialists, today, maxDay, closedWeekdays }, clients, rate] = await Promise.all([
    getBookingOptions(),
    getClientOptions(),
    getRate(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Nueva cita" description="Clienta, servicio, día y hora." />
      <NewAppointment
        clients={clients}
        services={services}
        specialists={specialists}
        today={today}
        maxDay={maxDay}
        closedWeekdays={closedWeekdays}
        rate={rate.rate}
        countryCode={settings.countryCode}
      />
    </div>
  );
}

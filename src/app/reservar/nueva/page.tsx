import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentClient } from "@/lib/auth";
import { getBookingOptions, getClientPackages } from "@/data/booking";
import { getRate } from "@/lib/rate";
import { ClientBooking } from "./client-booking";

export const metadata = { title: "Tu cita" };

export default async function ClientBookingPage() {
  const client = await getCurrentClient();
  if (!client) redirect("/reservar");

  const [{ settings, services, specialists, today, maxDay, closedWeekdays }, packages, rate] = await Promise.all([
    getBookingOptions(),
    getClientPackages(client.id),
    getRate(),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-5">
      <Link
        href="/reservar"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition"
      >
        <ArrowLeft className="size-4" />
        Volver
      </Link>

      <ClientBooking
        services={services}
        specialists={specialists}
        packages={packages}
        today={today}
        maxDay={maxDay}
        closedWeekdays={closedWeekdays}
        rate={rate.rate}
        autoConfirm={settings.autoConfirm}
        business={settings.businessName}
      />
    </div>
  );
}

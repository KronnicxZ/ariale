import { fmtDayLong, fmtTime } from "@/lib/date";
import { formatBs, formatUsd } from "@/lib/money";
import { normalizePhone } from "@/lib/utils";

/**
 * No enviamos por API: armamos el mensaje y abrimos WhatsApp.
 * Funciona desde el celular de la manicurista sin cuenta de Meta ni costo.
 */

export function waLink(phone: string, message: string, countryCode = "+58") {
  const cc = countryCode.replace(/\D/g, "");
  const number = `${cc}${normalizePhone(phone)}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

type ApptForMessage = {
  startAt: Date | string;
  client: { name: string };
  services: { service: { name: string } }[];
};

export function appointmentConfirmedMessage(
  appt: ApptForMessage,
  business: string,
  totalCents?: number,
  rate?: number,
) {
  const services = appt.services.map((s) => s.service.name).join(" + ");
  const money =
    totalCents != null
      ? `\nTotal: ${formatUsd(totalCents)}${rate ? ` (${formatBs(totalCents, rate)})` : ""}`
      : "";
  return (
    `¡Hola ${firstName(appt.client.name)}! 💅\n\n` +
    `Tu cita en ${business} quedó confirmada:\n` +
    `📅 ${fmtDayLong(appt.startAt)}\n` +
    `🕐 ${fmtTime(appt.startAt)}\n` +
    `✨ ${services}${money}\n\n` +
    `Si necesitas cambiarla, escríbeme por aquí. ¡Te esperamos!`
  );
}

export function appointmentReminderMessage(appt: ApptForMessage, business: string) {
  const services = appt.services.map((s) => s.service.name).join(" + ");
  return (
    `¡Hola ${firstName(appt.client.name)}! 💕\n\n` +
    `Te recuerdo tu cita de mañana en ${business}:\n` +
    `🕐 ${fmtTime(appt.startAt)}\n` +
    `✨ ${services}\n\n` +
    `¿Todo bien para esa hora? Confírmame por favor 🙌`
  );
}

export function nextSessionMessage(clientName: string, serviceName: string, business: string) {
  return (
    `¡Hola ${firstName(clientName)}! 🌸\n\n` +
    `Ya toca tu próxima sesión de ${serviceName} en ${business}. ` +
    `Mantener el ciclo es lo que hace que el vello salga cada vez más fino.\n\n` +
    `¿Te agendo esta semana?`
  );
}

export function debtMessage(
  clientName: string,
  balanceCents: number,
  business: string,
  rate?: number,
) {
  return (
    `¡Hola ${firstName(clientName)}! 😊\n\n` +
    `Te escribo de ${business} para recordarte que tienes un saldo pendiente de ` +
    `${formatUsd(balanceCents)}${rate ? ` (${formatBs(balanceCents, rate)})` : ""}.\n\n` +
    `Cuando puedas me avisas y lo cuadramos. ¡Gracias!`
  );
}

export function birthdayMessage(clientName: string, business: string) {
  return (
    `¡Feliz cumpleaños, ${firstName(clientName)}! 🎉🎂\n\n` +
    `De parte de todo ${business}, te deseamos un día precioso. ` +
    `Pásate esta semana y te consentimos ✨`
  );
}

export function bookingLinkMessage(link: string, business: string) {
  return (
    `¡Hola! 💅 Ya puedes agendar tu cita en ${business} directo desde aquí:\n\n` +
    `${link}\n\n` +
    `Eliges servicio, día y hora en menos de un minuto.`
  );
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0];
}

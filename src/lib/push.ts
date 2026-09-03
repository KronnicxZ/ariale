import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@/lib/db";

/**
 * Avisos push a los teléfonos de Alejandra y Arianny. Si no hay credenciales
 * configuradas (en local, por ejemplo) no se manda nada — nunca debe tumbar
 * la creación de la cita por esto.
 */
function admin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  if (getApps().length === 0) {
    const credentials = JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    initializeApp({
      credential: cert({
        projectId: credentials.project_id,
        clientEmail: credentials.client_email,
        // El .env guarda los saltos de línea escapados.
        privateKey: credentials.private_key.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getMessaging();
}

/**
 * Le avisa a todo el equipo activo (las dos ven la misma agenda, así que
 * las dos deben enterarse) que alguien acaba de agendar desde la web.
 */
export async function avisarNuevaCita(input: {
  clientName: string;
  services: string;
  day: string;
  time: string;
}) {
  const messaging = admin();
  if (!messaging) return;

  const devices = await prisma.deviceToken.findMany({
    where: { user: { active: true } },
    select: { id: true, token: true },
  });
  if (devices.length === 0) return;

  const response = await messaging.sendEachForMulticast({
    tokens: devices.map((d) => d.token),
    notification: {
      title: "Nueva cita agendada",
      body: `${input.clientName} · ${input.services} · ${input.day} ${input.time}`,
    },
    android: { priority: "high" },
  });

  // Un token que ya no sirve (se desinstaló la app, cambió de teléfono) se
  // borra solo, para no seguir intentando mandarle nada.
  const vencidos = response.responses
    .map((r, i) => (!r.success && esTokenInvalido(r.error?.code) ? devices[i].id : null))
    .filter((id): id is string => id !== null);
  if (vencidos.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { id: { in: vencidos } } });
  }
}

function esTokenInvalido(code?: string) {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
}

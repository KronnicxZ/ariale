import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import readline from "node:readline/promises";

/**
 * Borra los datos de ejemplo y deja el estudio listo para trabajar de verdad.
 *
 *   npm run limpiar
 *
 * Se va: todo el movimiento inventado —clientas, citas, ventas, cobros,
 * gastos, compras, proveedores y recordatorios—.
 *
 * Se queda: la configuración del negocio, el horario, las cuentas de
 * Alejandra y Arianny, el catálogo de servicios con sus precios, los bonos
 * y las categorías de gasto. Es decir, todo lo que costó trabajo ajustar.
 */

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // En producción las variables ya vienen del entorno.
}

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  }),
});

async function main() {
  const [clientas, citas, ventas] = await Promise.all([
    prisma.client.count(),
    prisma.appointment.count(),
    prisma.sale.count(),
  ]);

  console.log("Se va a borrar:");
  console.log(`  ${clientas} clientas`);
  console.log(`  ${citas} citas`);
  console.log(`  ${ventas} ventas, con sus cobros`);
  console.log("  gastos, compras, proveedores y recordatorios");
  console.log("");
  console.log("Se queda:");
  console.log("  la configuración, el horario y las cuentas del equipo");
  console.log("  el catálogo de servicios con sus precios y los bonos");
  console.log("  las categorías de gasto");
  console.log("");
  console.log("Haz antes `npm run respaldo` si quieres poder volver atrás.");
  console.log("");

  const consola = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const respuesta = await consola.question('Escribe "borrar" para continuar: ');
  consola.close();

  if (respuesta.trim().toLowerCase() !== "borrar") {
    console.log("Cancelado. No se tocó nada.");
    return;
  }

  // El orden importa: primero lo que apunta a otras tablas.
  await prisma.reminderLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.clientPackage.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.appointmentService.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.purchasePayment.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.client.deleteMany();

  console.log("");
  console.log("Listo. El estudio arranca de cero, con su catálogo intacto.");
  console.log("Ya puedes empezar a agendar de verdad.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    // Salimos a mano: el cliente nativo de libSQL a veces revienta al
    // desmontarse después de un lote grande de borrados.
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

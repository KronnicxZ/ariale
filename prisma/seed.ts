import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  /* en CI las variables ya están en el entorno */
}

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  }),
});

const CARACAS_OFFSET_MIN = -4 * 60;

/** Construye un instante UTC a partir de una fecha/hora local de Caracas. */
function caracas(y: number, m: number, d: number, hh = 0, mm = 0) {
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - CARACAS_OFFSET_MIN * 60_000);
}

function daysAgo(n: number, hh = 10, mm = 0) {
  const base = new Date(Date.now() - n * 86_400_000);
  return caracas(base.getFullYear(), base.getMonth() + 1, base.getDate(), hh, mm);
}

function daysAhead(n: number, hh = 10, mm = 0) {
  return daysAgo(-n, hh, mm);
}

/**
 * El seed BORRA TODO y vuelve a escribir datos de ejemplo. Una vez que el
 * estudio empieza a usar la app de verdad, correrlo sin querer se lleva por
 * delante meses de trabajo. Por eso se planta si encuentra datos que no
 * puso él, salvo que se le insista con `npm run seed -- --forzar`.
 */
async function comprobarQueEsSeguro() {
  if (process.argv.includes("--forzar")) return;

  const [citas, ventas] = await Promise.all([
    prisma.appointment.count(),
    prisma.sale.count(),
  ]);
  if (citas === 0 && ventas === 0) return;

  console.error("");
  console.error("  La base ya tiene " + citas + " citas y " + ventas + " ventas.");
  console.error("  El seed las borraría todas y pondría datos de ejemplo.");
  console.error("");
  console.error("  Si quieres empezar de cero conservando el catálogo:");
  console.error("      npm run limpiar");
  console.error("");
  console.error("  Si de verdad quieres los datos de ejemplo otra vez:");
  console.error("      npm run seed -- --forzar");
  console.error("");
  process.exit(1);
}

async function main() {
  await comprobarQueEsSeguro();

  console.log("Limpiando base de datos…");
  await prisma.reminderLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.clientPackage.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.appointmentService.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.purchasePayment.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.packageService.deleteMany();
  await prisma.package.deleteMany();
  await prisma.specialistService.deleteMany();
  await prisma.service.deleteMany();
  await prisma.category.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.specialist.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workingHour.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.exchangeRate.deleteMany();

  console.log("Configuración del negocio…");
  await prisma.settings.create({
    data: {
      id: 1,
      businessName: "Arialé Studio",
      tagline: "Diseñando tu mejor versión con amor y detalle",
      logoUrl: "/marca/logo-ariale.png",
      slug: "ariale-studio",
      phone: "04241354645",
      whatsapp: "04241354645",
      instagram: "arialestudio",
      address: "Caracas, Venezuela",
      timezone: "America/Caracas",
      countryCode: "+58",
      slotMinutes: 30,
      autoConfirm: false,
      maxDaysAhead: 45,
      minHoursAhead: 1,
      currencyLabel: "Dólar BCV",
      rateMode: "AUTO",
      manualRate: 240,
      accentColor: "#E9B21C",
      menuColor: "#1A1A1A",
    },
  });

  // Lunes a sábado; domingo cerrado.
  await prisma.workingHour.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      enabled: dayOfWeek !== 0,
      openTime: "09:00",
      closeTime: dayOfWeek === 6 ? "16:00" : "18:00",
    })),
  });

  console.log("Especialistas…");
  // El estudio son dos: Alejandra lleva uñas y Arianny, depilación.
  const [alejandra, arianny] = await Promise.all([
    prisma.specialist.create({
      data: { name: "Alejandra", slug: "alejandra", pin: "1234", color: "#E9B21C", phone: "04241354645" },
    }),
    prisma.specialist.create({
      data: { name: "Arianny", slug: "arianny", pin: "2468", color: "#BDAEDC", phone: "04141234567" },
    }),
  ]);

  console.log("Cuentas del equipo…");
  // Cada una entra con su propia cuenta y ve la agenda completa: saber qué
  // tiene la otra es justo lo que hace que el estudio funcione. La cuenta
  // solo decide a quién saluda la app y a quién pone primero al agendar.
  const cuentaAlejandra = await prisma.user.create({
    data: {
      name: "Alejandra",
      email: "alejandra@arialestudio.com",
      phone: "04241354645",
      passwordHash: await bcrypt.hash("alejandra2026", 10),
      role: "OWNER",
      specialistId: alejandra.id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Arianny",
      email: "arianny@arialestudio.com",
      phone: "04141234567",
      passwordHash: await bcrypt.hash("arianny2026", 10),
      role: "OWNER",
      specialistId: arianny.id,
    },
  });

  console.log("Categorías y servicios…");
  const depilacion = await prisma.category.create({
    data: {
      name: "Depilaciones",
      slug: "depilaciones",
      kind: "DEPILATION",
      color: "#E9A8B4",
      icon: "wand-sparkles",
      order: 1,
    },
  });
  const manicure = await prisma.category.create({
    data: {
      name: "Manicure & Sistemas",
      slug: "manicure-sistemas",
      kind: "MANICURE",
      color: "#E9B21C",
      icon: "sparkles",
      order: 2,
    },
  });
  const pedicura = await prisma.category.create({
    data: { name: "Pedicura", slug: "pedicura", kind: "PEDICURE", color: "#A8C7A9", icon: "footprints", order: 3 },
  });

  // Precios tomados de la lista oficial del estudio (USD).
  const serviceData = [
    {
      name: "Diseño + Depilación de cejas",
      categoryId: depilacion.id,
      priceCents: 500,
      durationMin: 30,
      bodyZone: "Cejas",
      method: "WAX" as const,
      sessionIntervalDays: 21,
      order: 1,
    },
    {
      name: "Cejas + Bozo + Pigmento",
      categoryId: depilacion.id,
      priceCents: 600,
      durationMin: 45,
      bodyZone: "Rostro",
      method: "WAX" as const,
      sessionIntervalDays: 21,
      order: 2,
    },
    {
      name: "Mentón",
      categoryId: depilacion.id,
      priceCents: 300,
      durationMin: 15,
      bodyZone: "Rostro",
      method: "WAX" as const,
      sessionIntervalDays: 21,
      order: 3,
    },
    {
      name: "Nariz",
      categoryId: depilacion.id,
      priceCents: 400,
      durationMin: 15,
      bodyZone: "Rostro",
      method: "WAX" as const,
      sessionIntervalDays: 21,
      order: 4,
    },
    {
      name: "Axilas",
      categoryId: depilacion.id,
      priceCents: 500,
      durationMin: 20,
      bodyZone: "Axilas",
      method: "WAX" as const,
      sessionIntervalDays: 28,
      order: 5,
    },
    {
      name: "Media pierna",
      categoryId: depilacion.id,
      priceCents: 1000,
      durationMin: 35,
      bodyZone: "Piernas",
      method: "WAX" as const,
      sessionIntervalDays: 28,
      order: 6,
    },
    {
      name: "Piernas completas",
      categoryId: depilacion.id,
      priceCents: 1500,
      durationMin: 60,
      bodyZone: "Piernas",
      method: "WAX" as const,
      sessionIntervalDays: 28,
      order: 7,
    },
    {
      name: "Zona de bikini",
      categoryId: depilacion.id,
      priceCents: 700,
      durationMin: 30,
      bodyZone: "Bikini",
      method: "WAX" as const,
      sessionIntervalDays: 28,
      order: 8,
    },
    {
      name: "Pubis",
      categoryId: depilacion.id,
      priceCents: 1500,
      durationMin: 40,
      bodyZone: "Bikini",
      method: "WAX" as const,
      sessionIntervalDays: 28,
      requiresPatchTest: true,
      order: 9,
    },
    {
      name: "Zona abdominal",
      categoryId: depilacion.id,
      priceCents: 300,
      durationMin: 15,
      bodyZone: "Abdomen",
      method: "WAX" as const,
      sessionIntervalDays: 28,
      order: 10,
    },

    {
      name: "Sistema de Polygel",
      categoryId: manicure.id,
      priceCents: 2000,
      durationMin: 150,
      order: 1,
    },
    {
      name: "Nivelación con Building Gel",
      categoryId: manicure.id,
      priceCents: 1500,
      durationMin: 120,
      order: 2,
    },
    {
      name: "Mantenimiento (Polygel & Building)",
      categoryId: manicure.id,
      priceCents: 1500,
      durationMin: 105,
      order: 3,
    },
    {
      name: "Esmaltado Semipermanente",
      categoryId: manicure.id,
      priceCents: 1200,
      durationMin: 75,
      order: 4,
    },

    // Pedicura: precios de referencia, ajustables desde el panel.
    { name: "Pedicura spa", categoryId: pedicura.id, priceCents: 1500, durationMin: 75, order: 1 },
    {
      name: "Pedicura semipermanente",
      categoryId: pedicura.id,
      priceCents: 1800,
      durationMin: 90,
      order: 2,
    },
  ];

  const services: { id: string; name: string; categoryId: string; priceCents: number; durationMin: number }[] = [];
  for (const data of serviceData) {
    services.push(await prisma.service.create({ data }));
  }
  const byName = (name: string) => {
    const found = services.find((s) => s.name === name);
    if (!found) throw new Error(`Servicio no encontrado en el seed: ${name}`);
    return found;
  };

  // Alejandra lleva uñas y pies; Arianny, todo lo de depilación.
  const depServices = services.filter((s) => s.categoryId === depilacion.id);
  const nailServices = services.filter((s) => s.categoryId !== depilacion.id);
  await prisma.specialistService.createMany({
    data: [
      ...nailServices.map((s) => ({ specialistId: alejandra.id, serviceId: s.id })),
      ...depServices.map((s) => ({ specialistId: arianny.id, serviceId: s.id })),
      // Las cejas las hacen las dos: es lo que más se pide.
      { specialistId: alejandra.id, serviceId: byName("Diseño + Depilación de cejas").id },
    ],
  });

  console.log("Bonos de depilación…");
  const bonoAxilas = await prisma.package.create({
    data: {
      name: "Bono 6 sesiones — Axilas",
      description: "Seis sesiones de axilas por el precio de cinco. Válido un año.",
      sessions: 6,
      priceCents: 2500,
      validityDays: 365,
      services: { create: [{ serviceId: byName("Axilas").id }] },
    },
  });
  const bonoPiernas = await prisma.package.create({
    data: {
      name: "Bono 6 sesiones — Piernas completas",
      description: "Seis sesiones de piernas completas con descuento.",
      sessions: 6,
      priceCents: 7500,
      validityDays: 365,
      services: { create: [{ serviceId: byName("Piernas completas").id }] },
    },
  });
  await prisma.package.create({
    data: {
      name: "Bono Full Body — 4 sesiones",
      description: "Piernas completas + axilas + zona de bikini, cuatro veces.",
      sessions: 4,
      priceCents: 8000,
      validityDays: 240,
      services: {
        create: [
          { serviceId: byName("Piernas completas").id },
          { serviceId: byName("Axilas").id },
          { serviceId: byName("Zona de bikini").id },
        ],
      },
    },
  });
  await prisma.package.create({
    data: {
      name: "Bono Rostro — 6 sesiones de cejas",
      description: "Diseño y depilación de cejas cada tres semanas.",
      sessions: 6,
      priceCents: 2500,
      validityDays: 365,
      services: { create: [{ serviceId: byName("Diseño + Depilación de cejas").id }] },
    },
  });

  console.log("Clientas…");
  // Tres, no ocho: lo justo para ver una ficha con historial, una con
  // saldo pendiente y una con bono, sin que la lista se vuelva ruido.
  const clientSeed = [
    { name: "Camila Reyes", phone: "4241112233", email: "camila@gmail.com" },
    {
      name: "Daniela Cruz",
      phone: "4142223344",
      instagram: "danicruz",
      allergies: "Sensible a la cera caliente",
    },
    { name: "Verónica Silva", phone: "4127778899" },
  ];
  const clients: { id: string; name: string; phone: string }[] = [];
  for (const [i, data] of clientSeed.entries()) {
    clients.push(
      await prisma.client.create({
        data: {
          ...data,
          birthday: caracas(1995, ((i * 3) % 12) + 1, ((i * 5) % 27) + 1),
          createdAt: daysAgo(150 - i * 20),
        },
      }),
    );
  }

  console.log("Proveedores…");
  const [distri, insumos] = await Promise.all([
    prisma.supplier.create({
      data: { name: "Distribuidora Nails Center", phone: "2125551234", email: "ventas@nailscenter.com" },
    }),
    prisma.supplier.create({ data: { name: "Cera & Spa Import", phone: "2125555678" } }),
  ]);

  console.log("Categorías de gasto…");
  const expenseCats = await Promise.all(
    [
      { name: "Insumos", color: "#E9B21C" },
      { name: "Alquiler", color: "#BDAEDC" },
      { name: "Servicios", color: "#A6C4DC" },
      { name: "Publicidad", color: "#E9A8B4" },
      { name: "Personal", color: "#A8C7A9" },
    ].map((data) => prisma.expenseCategory.create({ data })),
  );

  console.log("Historial de citas y ventas…");
  let saleNumber = 1;

  type Visit = {
    client: (typeof clients)[number];
    specialistId: string;
    serviceNames: string[];
    startAt: Date;
    status: "ATTENDED" | "CONFIRMED" | "PENDING" | "CANCELLED";
    paidRatio?: number;
    dueInDays?: number;
    note?: string;
  };

  async function createVisit(visit: Visit) {
    const { client, specialistId, serviceNames, startAt, status, paidRatio = 1, dueInDays, note } = visit;
    const picked = serviceNames.map(byName);
    const duration = picked.reduce((sum, s) => sum + s.durationMin, 0);
    const total = picked.reduce((sum, s) => sum + s.priceCents, 0);

    const appointment = await prisma.appointment.create({
      data: {
        clientId: client.id,
        specialistId,
        startAt,
        endAt: new Date(startAt.getTime() + duration * 60_000),
        status,
        source: "ADMIN",
        note,
        services: {
          create: picked.map((s) => ({
            serviceId: s.id,
            priceCents: s.priceCents,
            durationMin: s.durationMin,
          })),
        },
      },
    });

    if (status !== "ATTENDED") return;

    const paid = Math.round(total * paidRatio);
    const sale = await prisma.sale.create({
      data: {
        number: saleNumber++,
        date: startAt,
        clientId: client.id,
        specialistId,
        appointmentId: appointment.id,
        subtotalCents: total,
        totalCents: total,
        paidCents: paid,
        status: paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING",
        dueDate: dueInDays != null ? daysAhead(dueInDays) : null,
        items: {
          create: picked.map((s) => ({
            serviceId: s.id,
            description: s.name,
            quantity: 1,
            unitPriceCents: s.priceCents,
            totalCents: s.priceCents,
          })),
        },
      },
    });

    if (paid > 0) {
      await prisma.payment.create({
        data: {
          saleId: sale.id,
          date: startAt,
          amountCents: paid,
          method: paid === total ? "CASH_USD" : "PAGO_MOVIL",
        },
      });
    }
  }

  // Generamos la agenda de forma determinista, para que el panel muestre un
  // volumen parecido al de un estudio real y los porcentajes tengan sentido.
  let seedValue = 20260901;
  function rand() {
    seedValue = (seedValue * 1103515245 + 12345) % 2147483648;
    return seedValue / 2147483648;
  }
  function pick<T>(list: T[]): T {
    return list[Math.floor(rand() * list.length)];
  }

  const NAIL_COMBOS = [
    ["Esmaltado Semipermanente"],
    ["Esmaltado Semipermanente"],
    ["Sistema de Polygel"],
    ["Nivelación con Building Gel"],
    ["Mantenimiento (Polygel & Building)"],
    ["Mantenimiento (Polygel & Building)"],
    ["Esmaltado Semipermanente", "Diseño + Depilación de cejas"],
    ["Pedicura spa"],
    ["Pedicura semipermanente"],
  ];

  const WAX_COMBOS = [
    ["Diseño + Depilación de cejas"],
    ["Diseño + Depilación de cejas"],
    ["Cejas + Bozo + Pigmento"],
    ["Axilas"],
    ["Axilas", "Media pierna"],
    ["Piernas completas", "Axilas"],
    ["Zona de bikini", "Axilas"],
    ["Pubis"],
    ["Media pierna"],
    ["Nariz"],
    ["Mentón"],
    ["Zona abdominal", "Axilas"],
  ];

  const NOTES = [
    "Quiere francesa con dorado",
    "Llega 10 minutos tarde",
    "Prefiere tono nude",
    "Trae su diseño en foto",
    null,
    null,
    null,
    null,
  ];

  const visits: Visit[] = [];
  const OPEN_MIN = 9 * 60;

  // Diez días de historial + los próximos cinco. Con tres clientas es lo
  // que da un puñado de citas y de ventas para ver, sin llenar la agenda
  // de nombres repetidos ni inventar meses de trabajo que nunca pasaron.
  for (let offset = -10; offset <= 5; offset++) {
    const date = new Date(Date.now() + offset * 86_400_000);
    if (date.getDay() === 0) continue; // domingo cerrado
    const saturday = date.getDay() === 6;
    const closeMin = saturday ? 16 * 60 : 18 * 60;
    const past = offset < 0;

    for (const person of [
      { id: alejandra.id, combos: NAIL_COMBOS },
      { id: arianny.id, combos: WAX_COMBOS },
    ]) {
      let cursor = OPEN_MIN + Math.floor(rand() * 3) * 30;
      // Como mucho una cita al día por persona, y no todos los días. Es
      // una agenda de muestra, no la de un estudio a reventar.
      const carga = rand();
      const target = carga < 0.45 ? 0 : carga > 0.92 ? 2 : 1;

      for (let i = 0; i < target; i++) {
        const serviceNames = pick(person.combos);
        const duration = serviceNames.reduce((sum, name) => sum + byName(name).durationMin, 0);
        if (cursor + duration > closeMin) break;

        const client = pick(clients);
        const roll = rand();

        visits.push({
          client,
          specialistId: person.id,
          serviceNames,
          startAt: daysAgo(-offset, Math.floor(cursor / 60), cursor % 60),
          status: past
            ? roll < 0.05
              ? "CANCELLED"
              : "ATTENDED"
            : roll < 0.3
              ? "PENDING"
              : "CONFIRMED",
          // Un 12% de las visitas quedan a crédito, como pasa de verdad.
          paidRatio: past ? (roll > 0.94 ? 0 : roll > 0.88 ? 0.5 : 1) : 1,
          dueInDays: past && roll > 0.88 ? Math.floor(rand() * 20) - 8 : undefined,
          note: past ? undefined : (pick(NOTES) ?? undefined),
        });

        cursor += duration + 30;
      }
    }
  }

  for (const visit of visits) await createVisit(visit);

  console.log("Bonos vendidos…");
  const bonoSale = await prisma.sale.create({
    data: {
      number: saleNumber++,
      date: daysAgo(35, 14),
      clientId: clients[1].id,
      specialistId: arianny.id,
      subtotalCents: bonoPiernas.priceCents,
      totalCents: bonoPiernas.priceCents,
      paidCents: bonoPiernas.priceCents,
      status: "PAID",
      items: {
        create: [
          {
            description: bonoPiernas.name,
            quantity: 1,
            unitPriceCents: bonoPiernas.priceCents,
            totalCents: bonoPiernas.priceCents,
          },
        ],
      },
      payments: {
        create: [{ date: daysAgo(35, 14), amountCents: bonoPiernas.priceCents, method: "ZELLE" }],
      },
    },
  });
  await prisma.clientPackage.create({
    data: {
      clientId: clients[1].id,
      packageId: bonoPiernas.id,
      purchasedAt: daysAgo(35),
      expiresAt: daysAhead(330),
      sessionsTotal: bonoPiernas.sessions,
      sessionsUsed: 2,
      pricePaidCents: bonoPiernas.priceCents,
      saleId: bonoSale.id,
    },
  });
  await prisma.clientPackage.create({
    data: {
      clientId: clients[2].id,
      packageId: bonoAxilas.id,
      purchasedAt: daysAgo(20),
      expiresAt: daysAhead(345),
      sessionsTotal: bonoAxilas.sessions,
      sessionsUsed: 1,
      pricePaidCents: bonoAxilas.priceCents,
    },
  });

  console.log("Compras y gastos…");

  // Compras de insumos cada dos o tres semanas, a la escala del estudio.
  const purchases = [
    { supplierId: distri.id, description: "Polygel, building gel y tips", totalCents: 18000, paidCents: 18000, date: daysAgo(52) },
    { supplierId: insumos.id, description: "Cera brasileña y bandas — caja x12", totalCents: 9500, paidCents: 9500, date: daysAgo(44) },
    { supplierId: distri.id, description: "Esmaltes semipermanentes y limas", totalCents: 12000, paidCents: 12000, date: daysAgo(33) },
    { supplierId: insumos.id, description: "Aceite post-depilatorio y talco", totalCents: 4200, paidCents: 4200, date: daysAgo(24) },
    { supplierId: distri.id, description: "Reposición de polygel y monómero", totalCents: 15000, paidCents: 7500, date: daysAgo(12), dueDate: daysAhead(9) },
    { supplierId: insumos.id, description: "Cera y espátulas — pedido del mes", totalCents: 8800, paidCents: 0, date: daysAgo(4), dueDate: daysAhead(16) },
  ];
  let purchaseNumber = 1;
  for (const data of purchases) {
    const status = data.paidCents >= data.totalCents ? "PAID" : data.paidCents > 0 ? "PARTIAL" : "PENDING";
    const purchase = await prisma.purchase.create({
      data: { ...data, number: purchaseNumber++, status },
    });
    if (data.paidCents > 0) {
      await prisma.purchasePayment.create({
        data: { purchaseId: purchase.id, date: data.date, amountCents: data.paidCents, method: "TRANSFER" },
      });
    }
  }

  // Gastos fijos que se repiten mes a mes, más los variables.
  const expenses: { categoryId: string; description: string; amountCents: number; date: Date }[] = [];
  for (const monthOffset of [0, 1]) {
    const base = 8 + monthOffset * 30;
    expenses.push(
      { categoryId: expenseCats[1].id, description: "Alquiler del local", amountCents: 25000, date: daysAgo(base + 20) },
      { categoryId: expenseCats[2].id, description: "Electricidad e internet", amountCents: 3800, date: daysAgo(base + 18) },
      { categoryId: expenseCats[3].id, description: "Pauta en Instagram", amountCents: 2500, date: daysAgo(base + 14) },
      { categoryId: expenseCats[0].id, description: "Algodón, guantes y desinfectante", amountCents: 2600, date: daysAgo(base + 10) },
      { categoryId: expenseCats[4].id, description: "Comisión Arianny — quincena", amountCents: 9000, date: daysAgo(base + 7) },
      { categoryId: expenseCats[4].id, description: "Comisión Arianny — quincena", amountCents: 9500, date: daysAgo(base) },
      { categoryId: expenseCats[2].id, description: "Agua potable y aseo", amountCents: 1600, date: daysAgo(base + 4) },
    );
  }
  expenses.push(
    { categoryId: expenseCats[0].id, description: "Toallas desechables", amountCents: 1900, date: daysAgo(3) },
    { categoryId: expenseCats[3].id, description: "Sesión de fotos para el catálogo", amountCents: 4000, date: daysAgo(6) },
  );
  for (const data of expenses) {
    await prisma.expense.create({ data: { ...data, userId: cuentaAlejandra.id, method: "CASH_USD" } });
  }

  // La tasa del día NO se siembra: la app la pide sola a DolarAPI la
  // primera vez que alguien abre el panel. Sembrarla dejaba una tasa
  // inventada en caché y la de verdad no se consultaba nunca.

  console.log("Listo:", {
    clientas: await prisma.client.count(),
    servicios: await prisma.service.count(),
    citas: await prisma.appointment.count(),
    ventas: await prisma.sale.count(),
  });
  console.log("\n  Alejandra: alejandra@arialestudio.com / alejandra2026");
  console.log("  Arianny:   arianny@arialestudio.com / arianny2026");
  console.log("  Las dos ven la misma agenda.\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    // Salimos a mano: el cliente nativo de libSQL a veces revienta al
    // desmontarse después de un lote grande de escrituras.
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

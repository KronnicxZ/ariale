/**
 * Pasa los correos de acceso al dominio propio: @arialestudio.com pasa a
 * ser @ariale.space. La contraseña de cada quien no cambia.
 *
 *   npx tsx scripts/cambiar-dominio-correo.ts
 */
// Node no lee .env solo, y sin él se caería sobre una base local vacía.
// Tiene que pasar antes de importar el cliente, que lee la URL al cargarse.
process.loadEnvFile(".env");

const VIEJO = "@arialestudio.com";
const NUEVO = "@ariale.space";

async function main() {
  const { prisma } = await import("../src/lib/db");

  const usuarias = await prisma.user.findMany({
    where: { email: { endsWith: VIEJO } },
    select: { id: true, name: true, email: true },
  });

  if (usuarias.length === 0) {
    console.log("No queda ningún correo con el dominio viejo. Nada que hacer.");
    return;
  }

  for (const u of usuarias) {
    const nuevo = u.email.replace(VIEJO, NUEVO);
    const ocupado = await prisma.user.findUnique({ where: { email: nuevo } });
    if (ocupado) {
      console.log(`  ${u.email} → ${nuevo}: ya existe esa cuenta, la salto.`);
      continue;
    }
    await prisma.user.update({ where: { id: u.id }, data: { email: nuevo } });
    console.log(`  ${u.name}: ${u.email} → ${nuevo}`);
  }

  await prisma.$disconnect();
}

main();

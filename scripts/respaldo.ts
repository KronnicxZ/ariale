import fs from "node:fs";
import path from "node:path";

/**
 * Copia la base de datos con la fecha en el nombre.
 *
 *   npm run respaldo
 *
 * La base es un solo archivo, así que un respaldo es literalmente copiarlo.
 * Guarda los últimos treinta y borra los más viejos, para que la carpeta no
 * crezca sin fin.
 *
 * Con la base en Turso esto no hace falta: allí los respaldos son del propio
 * servicio. Ver BASE-DE-DATOS.md.
 */

const RAIZ = process.cwd();
const CARPETA = path.join(RAIZ, "respaldos");
const CUANTOS_GUARDAR = 30;

function archivoDeLaBase() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) {
    console.error(
      "La base no es un archivo local, sino " + url.split(":")[0] + ".\n" +
        "Los respaldos de Turso se hacen con `turso db shell <base> .dump`.",
    );
    process.exit(1);
  }
  return path.resolve(RAIZ, url.slice("file:".length));
}

function sello() {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}` +
    `-${dos(d.getHours())}${dos(d.getMinutes())}`
  );
}

const origen = archivoDeLaBase();
if (!fs.existsSync(origen)) {
  console.error(`No encontré la base en ${origen}`);
  process.exit(1);
}

fs.mkdirSync(CARPETA, { recursive: true });
const destino = path.join(CARPETA, `ariale-${sello()}.db`);
fs.copyFileSync(origen, destino);

const peso = (fs.statSync(destino).size / 1024 / 1024).toFixed(1);
console.log(`Respaldo guardado: ${destino} (${peso} MB)`);

// Nos quedamos con los más recientes.
const viejos = fs
  .readdirSync(CARPETA)
  .filter((f) => f.startsWith("ariale-") && f.endsWith(".db"))
  .sort()
  .reverse()
  .slice(CUANTOS_GUARDAR);

for (const f of viejos) fs.rmSync(path.join(CARPETA, f));
if (viejos.length) console.log(`Borrados ${viejos.length} respaldos antiguos.`);

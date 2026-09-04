import path from "node:path";
import fs from "node:fs";
import { put } from "@vercel/blob";

/**
 * Publica el APK que acaba de compilarse para que Alejandra y Arianny lo
 * reciban desde la propia app, sin tener que pasarles el archivo.
 *
 *   npm run publicar-apk -- "Qué cambió, en una línea"
 *
 * Hace dos cosas: sube el APK al almacén de archivos y anota la versión en
 * la base. La app pregunta por esa anotación al abrir.
 *
 * El número que manda es el de compilación —el "+3" de `version: 0.2.0+3`
 * en `movil/pubspec.yaml`—, así que hay que subirlo antes de compilar o la
 * app no verá la versión nueva como más nueva.
 */
process.loadEnvFile(path.join(process.cwd(), ".env"));

const APK = path.join(process.cwd(), "movil", "build", "app", "outputs", "flutter-apk", "app-release.apk");
const PUBSPEC = path.join(process.cwd(), "movil", "pubspec.yaml");

function leerVersion() {
  const linea = fs
    .readFileSync(PUBSPEC, "utf8")
    .split("\n")
    .find((l) => l.startsWith("version:"));
  if (!linea) throw new Error("No encontré `version:` en pubspec.yaml.");

  const valor = linea.replace("version:", "").trim();
  const [nombre, build] = valor.split("+");
  if (!nombre || !build) {
    throw new Error(`La versión "${valor}" no trae número de compilación. Debe ser "0.2.0+3".`);
  }
  return { nombre, build: Number(build) };
}

async function main() {
  const notas = process.argv.slice(2).join(" ").trim();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("");
    console.error("  Falta BLOB_READ_WRITE_TOKEN en .env.");
    console.error("  Está en Vercel → Storage → tu Blob Store → .env.local.");
    console.error("");
    process.exit(1);
  }
  if (!fs.existsSync(APK)) {
    console.error("");
    console.error(`  No encontré el APK en ${APK}`);
    console.error("  Compílalo primero:  cd movil; .\\construir-apk.ps1 -Servidor https://app.ariale.space");
    console.error("");
    process.exit(1);
  }

  const { nombre, build } = leerVersion();
  const { prisma } = await import("../src/lib/db");

  const anterior = await prisma.appRelease.findFirst({ orderBy: { buildNumber: "desc" } });
  if (anterior && anterior.buildNumber >= build) {
    console.error("");
    console.error(`  La última publicada es la ${anterior.version}+${anterior.buildNumber} y esta es ${nombre}+${build}.`);
    console.error("  Sube el número después del + en movil/pubspec.yaml y vuelve a compilar.");
    console.error("");
    process.exit(1);
  }

  const pesoMb = (fs.statSync(APK).size / 1024 / 1024).toFixed(1);
  console.log(`Subiendo ${nombre}+${build} (${pesoMb} MB)…`);

  // Sin sufijo aleatorio: la ruta lleva la versión, así que ya es única, y
  // así el enlace se puede escribir a mano si alguna vez hace falta.
  const subida = await put(`app/ariale-${nombre}-${build}.apk`, fs.readFileSync(APK), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/vnd.android.package-archive",
  });

  await prisma.appRelease.create({
    data: { version: nombre, buildNumber: build, url: subida.url, notes: notas || null },
  });

  console.log("");
  console.log(`  Publicada la ${nombre}+${build}`);
  console.log(`  ${subida.url}`);
  console.log("");
  console.log("  Al abrir la app les saldrá el aviso de actualización.");
  console.log("");
}

main();

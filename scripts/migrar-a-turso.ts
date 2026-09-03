import { createClient, type InValue } from "@libsql/client";
import path from "node:path";

/**
 * Copia la base local a Turso: primero la estructura, después las filas.
 *
 *   npm run migrar-turso
 *
 * No hace falta la herramienta de Turso ni sqlite3. Lee el archivo local
 * directamente y escribe en la base remota, tabla por tabla.
 *
 * Espera en el entorno:
 *   TURSO_DATABASE_URL   libsql://ariale-tuusuario.turso.io
 *   TURSO_AUTH_TOKEN     el token que da el panel de Turso
 *
 * Y deja `.env` como está: hasta que la migración no salga bien, la app
 * sigue trabajando contra el archivo local. El cambio de DATABASE_URL es el
 * último paso, y a mano.
 */

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // Si no hay .env, las variables vienen del entorno.
}

const urlRemota = process.env.TURSO_DATABASE_URL;
const tokenRemoto = process.env.TURSO_AUTH_TOKEN;

if (!urlRemota || !tokenRemoto) {
  console.error("");
  console.error("  Faltan las credenciales de Turso. Añádelas a .env:");
  console.error("");
  console.error('    TURSO_DATABASE_URL="libsql://ariale-tuusuario.turso.io"');
  console.error('    TURSO_AUTH_TOKEN="el-token-largo"');
  console.error("");
  process.exit(1);
}

const urlLocal = process.env.DATABASE_URL ?? "file:./dev.db";
if (!urlLocal.startsWith("file:")) {
  console.error(`DATABASE_URL ya apunta a ${urlLocal}. Esto migra DESDE el archivo local.`);
  process.exit(1);
}

const local = createClient({ url: urlLocal });
const remoto = createClient({ url: urlRemota, authToken: tokenRemoto });

/** Comillas para un identificador de SQLite. */
const id = (nombre: string) => `"${nombre.replace(/"/g, '""')}"`;

async function main() {
  const forzar = process.argv.includes("--forzar");

  // --- Estructura -------------------------------------------------------
  const esquema = await local.execute(
    `SELECT type, name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
     ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END`,
  );

  const tablas = esquema.rows
    .filter((r) => r.type === "table")
    .map((r) => String(r.name))
    .filter((n) => n !== "_prisma_migrations");

  // Si ya hay datos allá, no los pisamos sin permiso.
  if (!forzar) {
    for (const tabla of tablas) {
      try {
        const r = await remoto.execute(`SELECT COUNT(*) AS n FROM ${id(tabla)}`);
        const n = Number(r.rows[0]?.n ?? 0);
        if (n > 0) {
          console.error("");
          console.error(`  La base de Turso ya tiene datos (${tabla}: ${n} filas).`);
          console.error("  Si quieres reemplazarlos: npm run migrar-turso -- --forzar");
          console.error("");
          process.exit(1);
        }
      } catch {
        // La tabla todavía no existe allá: es lo esperado la primera vez.
      }
    }
  }

  console.log("Creando la estructura en Turso…");
  for (const fila of esquema.rows) {
    const sql = String(fila.sql);
    if (String(fila.name) === "_prisma_migrations") continue;
    // `IF NOT EXISTS` para poder repetir la migración sin romper nada.
    const seguro = sql
      .replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ")
      .replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
      .replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS ");
    await remoto.execute(seguro);
  }

  // --- Filas ------------------------------------------------------------
  // Se copia con `migrate`, que es el modo de libSQL que desactiva las
  // claves foráneas durante el lote. Así el orden de las tablas deja de
  // importar y no hay que resolver el grafo de dependencias.
  //
  // Un `PRAGMA foreign_keys = OFF` suelto no vale: cada petición HTTP puede
  // ir por una conexión distinta y el pragma se queda en la anterior.
  if (forzar) {
    await remoto.migrate(tablas.map((t) => `DELETE FROM ${id(t)}`));
  }

  let total = 0;
  for (const tabla of tablas) {

    const datos = await local.execute(`SELECT * FROM ${id(tabla)}`);
    if (datos.rows.length === 0) {
      console.log(`  ${tabla}: vacía`);
      continue;
    }

    const columnas = datos.columns;
    const huecos = columnas.map(() => "?").join(", ");
    const inserta = `INSERT INTO ${id(tabla)} (${columnas.map(id).join(", ")}) VALUES (${huecos})`;

    // De cien en cien: un lote enorme se queda sin memoria en el servidor.
    for (let i = 0; i < datos.rows.length; i += 100) {
      await remoto.migrate(
        datos.rows.slice(i, i + 100).map((fila) => ({
          sql: inserta,
          args: columnas.map(
            (c) => ((fila as Record<string, unknown>)[c] ?? null) as InValue,
          ),
        })),
      );
    }

    total += datos.rows.length;
    console.log(`  ${tabla}: ${datos.rows.length} filas`);
  }

  console.log("");
  console.log(`Listo: ${total} filas en ${tablas.length} tablas.`);
  console.log("");
  console.log("Último paso, a mano, en .env:");
  console.log(`    DATABASE_URL="${urlRemota}"`);
  console.log('    DATABASE_AUTH_TOKEN="…el mismo token…"');
  console.log("");
  console.log("Después reinicia `npm run dev` y comprueba que todo sigue ahí.");
}

main()
  .then(() => {
    local.close();
    remoto.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    local.close();
    remoto.close();
    process.exit(1);
  });

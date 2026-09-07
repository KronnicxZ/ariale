import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";

/**
 * Genera el icono de la app de Android a partir de la flor de la marca.
 *
 *   npm run iconos-app
 *
 * Se hace aquí y no a mano porque son quince archivos en cinco densidades,
 * y a mano siempre se queda alguno viejo.
 *
 * OJO CON LA RESOLUCIÓN. El archivo de la flor tiene 128×128, y de flor de
 * verdad solo 102×102 —el resto es aire—. Android pide 432×432 para el
 * icono adaptativo, así que hay un aumento de más del doble y de ahí sale
 * lo borroso: no hay más dibujo que ese. Si algún día aparece el original
 * (SVG, AI, PDF o un PNG de 1024 o más), se cambia `FLOR` por él, se vuelve
 * a ejecutar esto y el icono queda nítido sin tocar nada más.
 */

const RAIZ = process.cwd();
const FLOR = path.join(RAIZ, "public", "marca", "flor-ariale.png");
const RES = path.join(RAIZ, "movil", "android", "app", "src", "main", "res");

/** Las cinco densidades de Android, con el lado del icono en cada una. */
const DENSIDADES = [
  { carpeta: "mdpi", adaptativo: 108, clasico: 48 },
  { carpeta: "hdpi", adaptativo: 162, clasico: 72 },
  { carpeta: "xhdpi", adaptativo: 216, clasico: 96 },
  { carpeta: "xxhdpi", adaptativo: 324, clasico: 144 },
  { carpeta: "xxxhdpi", adaptativo: 432, clasico: 192 },
];

/**
 * Cuánto del lienzo ocupa la flor.
 *
 * En el icono adaptativo, Android recorta con la forma que use cada
 * teléfono y solo garantiza el 66 % central. Estaba al 42 % y se veía una
 * mota en un cuadro blanco; al 60 % llena el círculo seguro sin que se le
 * corte un pétalo.
 */
const PARTE_ADAPTATIVO = 0.6;

/** El clásico no lo recorta nadie, así que la flor puede ir más holgada. */
const PARTE_CLASICO = 0.68;

async function main() {
  if (!fs.existsSync(FLOR)) throw new Error(`No encontré la flor en ${FLOR}`);

  // El archivo trae aire alrededor: se recorta para encuadrar por el dibujo
  // y no por el margen, que es lo que hacía que la flor saliera pequeña.
  const flor = await sharp(FLOR).trim({ threshold: 5 }).toBuffer();
  const { width = 0, height = 0 } = await sharp(flor).metadata();
  console.log(`Flor de ${width}×${height} px de dibujo.`);
  if (width < 400) {
    console.log("  Aviso: por debajo de 400 px el icono grande sale blando.");
  }

  const transparente = { r: 0, g: 0, b: 0, alpha: 0 };

  /** La flor a un tamaño, con el mejor filtro y un pelín de nitidez. */
  const aEscala = (lado: number) =>
    sharp(flor)
      .resize(lado, lado, { fit: "contain", kernel: "lanczos3", background: transparente })
      .sharpen({ sigma: 0.6 })
      .toBuffer();

  for (const { carpeta, adaptativo, clasico } of DENSIDADES) {
    const destino = path.join(RES, `mipmap-${carpeta}`);
    fs.mkdirSync(destino, { recursive: true });

    // 1. La capa de delante del icono adaptativo: flor sobre nada.
    const arte = await aEscala(Math.round(adaptativo * PARTE_ADAPTATIVO));
    await sharp({
      create: { width: adaptativo, height: adaptativo, channels: 4, background: transparente },
    })
      .composite([{ input: arte, gravity: "centre" }])
      .png()
      .toFile(path.join(destino, "ic_launcher_foreground.png"));

    // 2. El icono de siempre, para los Android anteriores al adaptativo:
    //    flor sobre blanco, cuadrado y redondo.
    const arteClasico = await aEscala(Math.round(clasico * PARTE_CLASICO));
    const sobreBlanco = () =>
      sharp({
        create: {
          width: clasico,
          height: clasico,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      }).composite([{ input: arteClasico, gravity: "centre" }]);

    await sobreBlanco().png().toFile(path.join(destino, "ic_launcher.png"));

    // El redondo se recorta con un círculo, o en los lanzadores que lo usan
    // se ven las esquinas blancas fuera del círculo.
    const circulo = Buffer.from(
      `<svg width="${clasico}" height="${clasico}"><circle cx="${clasico / 2}" cy="${clasico / 2}" r="${clasico / 2}" fill="#fff"/></svg>`,
    );
    await sharp(await sobreBlanco().png().toBuffer())
      .composite([{ input: circulo, blend: "dest-in" }])
      .png()
      .toFile(path.join(destino, "ic_launcher_round.png"));

    console.log(`  ${carpeta}: ${adaptativo} y ${clasico} px`);
  }

  console.log("\nListo. Hay que recompilar el APK para verlo.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

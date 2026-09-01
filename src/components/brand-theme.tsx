/**
 * Inyecta los colores que la dueña eligió en "Mi negocio" como variables CSS,
 * de modo que toda la app (botones, menú, gráficos) se repinte sin recompilar.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

function safeColor(value: string | null | undefined, fallback: string) {
  return value && HEX.test(value) ? value : fallback;
}

export function BrandTheme({ accent, menu }: { accent?: string | null; menu?: string | null }) {
  const brand = safeColor(accent, "#C2185B");
  const sidebar = safeColor(menu, "#4A1130");

  const css = [
    ":root{",
    `--brand:${brand};`,
    `--menu:${sidebar};`,
    `--primary:${brand};`,
    `--ring:${brand};`,
    `--sidebar:${sidebar};`,
    `--sidebar-primary:${brand};`,
    `--chart-1:${brand};`,
    "}",
  ].join("");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

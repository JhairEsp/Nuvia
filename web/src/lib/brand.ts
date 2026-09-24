/** Marca comercial. No renombrar identificadores persistidos como parte de un cambio visual. */
export const BRAND_NAME = "Nuvia";

/** URL del negocio en el despliegue actual, sin dominios inventados ni slugs de demostración. */
export function publicBusinessUrl(slug: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = `/b/${encodeURIComponent(slug)}`;
  return url.toString();
}

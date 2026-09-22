// frontend-web/src/pages/SpriteDefs.tsx
import crucetaSvg from "./sprites/cruceta.svg?raw";
import aisladorPinSvg from "./sprites/aislador_pin.svg?raw";
import aisladorRemateSvg from "./sprites/aislador_remate.svg?raw";
import cortacircuitoFusibleSvg from "./sprites/cortacircuito_fusible.svg?raw";
import retenidaAnclaSvg from "./sprites/retenida_ancla.svg?raw";
import riostraSecundariaSvg from "./sprites/riostra_secundaria.svg?raw";
import apartarrayosSvg from "./sprites/apartarrayos.svg?raw";
import transformadorSvg from "./sprites/transformador.svg?raw";

/**
 * codigo (== ComponenteVisual.codigo en el backend) -> SVG fuente crudo.
 * Cada .svg ya viene recortado al ícono principal únicamente (sin mini-copia
 * ni texto de etiqueta — esos elementos solo existían para identificar el
 * archivo a simple vista al generarlo, no deben pintarse en el mapa).
 *
 * Pendiente: "aislador_set_3" ya existe en el catálogo del backend pero aún
 * no tenemos su .svg fuente — agrégalo aquí en cuanto lo tengas.
 */
const FUENTES_SVG: Record<string, string> = {
  cruceta: crucetaSvg,
  aislador_pin: aisladorPinSvg,
  aislador_remate: aisladorRemateSvg,
  cortacircuito_fusible: cortacircuitoFusibleSvg,
  retenida_ancla: retenidaAnclaSvg,
  riostra_secundaria: riostraSecundariaSvg,
  apartarrayos: apartarrayosSvg,
  transformador: transformadorSvg,
};

/** Códigos de componente que ya tienen dibujo en el sprite. */
export const CODIGOS_CON_DIBUJO = Object.keys(FUENTES_SVG);

function extraerViewBox(svgRaw: string): string {
  const match = svgRaw.match(/viewBox="([^"]+)"/);
  return match ? match[1] : "0 0 100 100";
}

function extraerContenido(svgRaw: string): string {
  return svgRaw
    .replace(/<\?xml[^>]*\?>/, "")
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
}

// Se construye una sola vez al cargar el módulo, no en cada render.
const SYMBOLS_HTML = Object.entries(FUENTES_SVG)
  .map(([codigo, raw]) => {
    const viewBox = extraerViewBox(raw);
    const contenido = extraerContenido(raw);
    return `<symbol id="${codigo}" viewBox="${viewBox}">${contenido}</symbol>`;
  })
  .join("");

/**
 * Sprite oculto: monta este componente UNA sola vez (p. ej. en el layout raíz
 * de la app), y luego referencia cualquier símbolo desde donde sea con:
 *
 *   <use href={`#${componente.codigo}`} x={x} y={y} width={ancho} height={alto} />
 */
export function SpriteDefs() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: `<defs>${SYMBOLS_HTML}</defs>` }}
    />
  );
}

/**
 * Dimensiones locales por componente, en las mismas unidades que
 * ComponenteVisual.ancho_px / alto_px del backend (escala: ~42 unidades = 1 m,
 * derivada del poste estándar de 12 m).
 *
 * NOTA / recomendación: esto duplica datos que ya viven en el backend. Está
 * bien como fallback rápido para desarrollo, pero considera que
 * useTramoConPostes.ts traiga ancho_px/alto_px directamente del serializer
 * de ComponenteVisual en vez de mantener dos fuentes de verdad — si un día
 * ajustas una medida en el admin de Django, este mapa no se entera.
 */
export const DIMENSIONES_COMPONENTE: Record<string, { ancho: number; alto: number }> = {
  cruceta: { ancho: 84, alto: 16 },
  aislador_pin: { ancho: 7, alto: 12 },
  aislador_set_3: { ancho: 25, alto: 12 },
  aislador_remate: { ancho: 17, alto: 4 },
  cortacircuito_fusible: { ancho: 9, alto: 23 },
  retenida_ancla: { ancho: 30, alto: 64 },
  riostra_secundaria: { ancho: 9, alto: 19 },
  apartarrayos: { ancho: 7, alto: 15 },
  transformador: { ancho: 21, alto: 29 },
};

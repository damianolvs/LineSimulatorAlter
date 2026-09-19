// frontend-web/src/pages/construirIconoPoste.ts
import { DIMENSIONES_COMPONENTE } from "./SpriteDefs";

/**
 * Forma esperada de cada componente ya resuelto por el hook de datos
 * (useTramoConPostes.ts). `componente_visual_codigo` es el slug del
 * catálogo (ComponenteVisual.codigo) — NO el id numérico de la FK.
 *
 * Backend: el serializer de PosteComponente debe exponer este campo,
 * por ejemplo con SlugRelatedField(slug_field="codigo", source="componente_visual").
 * Sin esto, el frontend no tiene forma de saber qué símbolo del sprite usar.
 */
export interface PosteComponenteDTO {
  id: number;
  componente_visual_codigo: string;
  modo: "auto" | "manual";
  x: number;
  y: number;
  rotacion: number;
  espejo: boolean;
  orden_z: number;
}

export interface ElementoIconoPoste {
  key: string;
  codigo: string;
  modo: "auto" | "manual";
  ordenZ: number;
  /** x/y del <use>, ya centrados respecto al punto de anclaje del componente. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** Aplícalo en un <g transform={transform}> que envuelva el <use>. */
  transform: string;
}

export interface IconoPoste {
  /** Dimensiones fijas del cuerpo del poste (independientes de la altura real
   * capturada en Poste.altura — ese campo es solo informativo, no se
   * reescala el SVG por ella; ver decisión de Damian). Placeholder hasta
   * integrar el símbolo real "PoleOnly". */
  poste: { ancho: number; alto: number };
  elementos: ElementoIconoPoste[];
}

const POSTE_ANCHO = 24;
const POSTE_ALTO = 504; // ~12 m estándar a ~42 unidades/m

function construirTransform(x: number, y: number, rotacion: number, espejo: boolean): string {
  const partes = [`translate(${x} ${y})`];
  if (rotacion) partes.push(`rotate(${rotacion})`);
  if (espejo) partes.push("scale(-1 1)");
  return partes.join(" ");
}

function construirElemento(c: PosteComponenteDTO): ElementoIconoPoste | null {
  const dims = DIMENSIONES_COMPONENTE[c.componente_visual_codigo];
  if (!dims) {
    console.warn(`construirIconoPoste: sin dimensiones para "${c.componente_visual_codigo}"`);
    return null;
  }
  return {
    key: String(c.id),
    codigo: c.componente_visual_codigo,
    modo: c.modo,
    ordenZ: c.orden_z,
    x: -dims.ancho / 2,
    y: -dims.alto / 2,
    ancho: dims.ancho,
    alto: dims.alto,
    transform: construirTransform(c.x, c.y, c.rotacion, c.espejo),
  };
}

/**
 * Convierte la lista de PosteComponente de un poste en los elementos que
 * el componente de mapa debe pintar con <use>. No dibuja nada por sí misma
 * (sin JSX) — mantenerla pura facilita probarla sin renderizar.
 *
 * El componente consumidor decide cómo marcar `modo === "manual"`
 * (halo/anillo, no cambio de color — ver decisión sobre SVGs multicolor).
 */
export function construirIconoPoste(componentes: PosteComponenteDTO[]): IconoPoste {
  const elementos = componentes
    .map(construirElemento)
    .filter((e): e is ElementoIconoPoste => e !== null)
    .sort((a, b) => a.ordenZ - b.ordenZ);

  return {
    poste: { ancho: POSTE_ANCHO, alto: POSTE_ALTO },
    elementos,
  };
}

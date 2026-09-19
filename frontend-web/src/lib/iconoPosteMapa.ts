// frontend-web/src/lib/iconoPosteMapa.ts
import L from "leaflet";
import type { PosteComponente } from "../api/tipos";

const POSICION_AISLADORES: Record<number, number[]> = { 1: [8.5], 2: [2.6, 14.4], 3: [2.6, 8.5, 14.4] };

interface Opciones {
  componentes: PosteComponente[];
  seleccionado: boolean;
  /** Texto bajo el poste (p. ej. "P-05 · TS3N"); vacío = sin etiqueta. */
  etiqueta: string;
}

/**
 * Dibujo del poste para el mapa, tal como en el mockup: fuste metálico,
 * cruceta, aisladores de vidrio y, si el poste lleva retenida, el tirante
 * hacia el lado en que está. Se arma con lo que el poste tiene realmente.
 */
function svgPoste(componentes: PosteComponente[], ancho: number, alto: number): string {
  const aisladores = Math.min(3, componentes.filter((c) => c.componente_visual_codigo.startsWith("aislador")).length);
  const retenidas = componentes.filter((c) => c.componente_visual_codigo === "retenida_ancla");
  const tirantes = [
    retenidas.some((c) => c.x < 0) ? "M8.5 9 2 25" : "",
    retenidas.some((c) => c.x >= 0) ? "M8.5 9 15 25" : "",
  ]
    .filter(Boolean)
    .map((d) => `<path d="${d}" stroke="#d9d4c6" stroke-width=".7" opacity=".85"/>`)
    .join("");
  const vidrios = (POSICION_AISLADORES[aisladores] ?? [])
    .map((cx) => `<circle cx="${cx}" cy="4" r="1.5" fill="url(#glass)" stroke="#2a2724" stroke-width=".4"/>`)
    .join("");

  return (
    `<svg width="${ancho}" height="${alto}" viewBox="0 0 17 27" style="position:relative;display:block">` +
    `<ellipse cx="8.5" cy="25.6" rx="5" ry="1.4" fill="#12100e" opacity=".5"/>` +
    `<rect x="7.2" y="3" width="2.6" height="22.4" fill="url(#metalV)" stroke="#2a2724" stroke-width=".5"/>` +
    `<rect x="1.6" y="5.2" width="13.8" height="2" rx=".5" fill="url(#metalH)" stroke="#2a2724" stroke-width=".5"/>` +
    vidrios +
    tirantes +
    `</svg>`
  );
}

const escapar = (texto: string) => texto.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * `iconSize` 0×0 con el anclaje en el punto exacto: el pie del poste queda sobre
 * la coordenada y la etiqueta cuelga debajo, sin desplazar al marcador.
 */
export function iconoPosteMapa({ componentes, seleccionado, etiqueta }: Opciones): L.DivIcon {
  const poste = seleccionado
    ? `<span style="position:absolute;left:50%;bottom:-9px;transform:translateX(-50%);width:46px;height:46px;border-radius:50%;border:2px solid #b68235;background:rgba(182,130,53,.16);box-shadow:0 0 0 3px rgba(240,226,200,.35)"></span>` +
      `<span style="position:absolute;left:50%;bottom:-3px;transform:translateX(-50%);width:30px;height:12px;border-radius:50%;border:1px dashed rgba(240,226,200,.7)"></span>` +
      svgPoste(componentes, 22, 34)
    : svgPoste(componentes, 17, 27);

  const estiloEtiqueta = seleccionado
    ? "background:#b68235;color:#1d1b18;font-size:10px;font-weight:600;padding:1px 5px;margin-top:12px"
    : "background:rgba(25,23,20,.8);color:#f4ead8;font-size:9.5px;padding:1px 4px;margin-top:2px";
  const textoEtiqueta = etiqueta
    ? `<span style="position:absolute;left:0;top:0;transform:translateX(-50%);white-space:nowrap;border-radius:2px;font-variant-numeric:tabular-nums;${estiloEtiqueta}">${escapar(etiqueta)}</span>`
    : "";

  return L.divIcon({
    className: "marcador-poste",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html:
      `<div style="position:relative;width:0;height:0">` +
      `<div style="position:absolute;left:0;bottom:0;transform:translateX(-50%)">${poste}</div>` +
      textoEtiqueta +
      `</div>`,
  });
}

/** Etiqueta de distancia sobre el vano; dorada cuando el vano toca al poste seleccionado. */
export function iconoVano(metros: number, resaltado: boolean): L.DivIcon {
  const estilo = resaltado
    ? "background:rgba(182,130,53,.92);color:#1d1b18;font-weight:600"
    : "background:rgba(25,23,20,.78);color:#f4ead8";
  return L.divIcon({
    className: "etiqueta-vano",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<span style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);white-space:nowrap;font-size:10.5px;padding:2px 6px;border-radius:2px;font-variant-numeric:tabular-nums;${estilo}">${Math.round(metros)} m</span>`,
  });
}

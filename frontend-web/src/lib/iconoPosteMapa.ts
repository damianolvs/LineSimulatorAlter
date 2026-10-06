// frontend-web/src/lib/iconoPosteMapa.ts
import L from "leaflet";
import type { PosteComponente } from "../api/tipos";
import { PROPORCION_POSTE } from "./tamanoPosteMapa";

const POSICION_AISLADORES: Record<number, number[]> = { 1: [8.5], 2: [2.6, 14.4], 3: [2.6, 8.5, 14.4] };

interface Opciones {
  componentes: PosteComponente[];
  seleccionado: boolean;
  /** Texto bajo el poste (p. ej. "P-05 · TS3N"); vacío = sin etiqueta. */
  etiqueta: string;
  /** Altura del dibujo en px (ver `alturaPosteMapa`); el ancho y los adornos se escalan con ella. */
  alto: number;
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
export function iconoPosteMapa({ componentes, seleccionado, etiqueta, alto }: Opciones): L.DivIcon {
  const k = alto / 27; // 1 = tamaño original del dibujo
  const altoPoste = Math.round(seleccionado ? alto * 1.25 : alto);
  const anchoPoste = Math.round(altoPoste * PROPORCION_POSTE);
  const aro = Math.round(46 * k);
  const elipse = Math.round(30 * k);
  const poste = seleccionado
    ? `<span style="position:absolute;left:50%;bottom:${Math.round(-9 * k)}px;transform:translateX(-50%);width:${aro}px;height:${aro}px;border-radius:50%;border:2px solid #b68235;background:rgba(182,130,53,.16);box-shadow:0 0 0 3px rgba(240,226,200,.35)"></span>` +
      `<span style="position:absolute;left:50%;bottom:${Math.round(-3 * k)}px;transform:translateX(-50%);width:${elipse}px;height:${Math.round(12 * k)}px;border-radius:50%;border:1px dashed rgba(240,226,200,.7)"></span>` +
      svgPoste(componentes, anchoPoste, altoPoste)
    : svgPoste(componentes, anchoPoste, altoPoste);

  const fuente = Math.round(Math.min(12.5, Math.max(9.5, 8.5 + k * 1.3)) * 10) / 10;
  const margen = Math.round(2 * k);
  const estiloEtiqueta = seleccionado
    ? `background:#b68235;color:#1d1b18;font-size:${fuente + 0.5}px;font-weight:600;padding:1px 5px;margin-top:${Math.round(12 * k)}px`
    : `background:rgba(25,23,20,.8);color:#f4ead8;font-size:${fuente}px;padding:1px 4px;margin-top:${margen}px`;
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

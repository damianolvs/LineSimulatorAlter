// frontend-web/src/lib/tamanoPosteMapa.ts

/** Relación ancho/alto del dibujo del poste en el mapa (viewBox 17×27). */
export const PROPORCION_POSTE = 17 / 27;

/** Altura en px del icono del poste según el zoom: (zoom, alto). Entre puntos se interpola. */
const ESCALA: [number, number][] = [
  [14, 28],
  [15, 32],
  [16, 40],
  [17, 48],
  [18, 56],
  [19, 62],
];

/**
 * Altura (px) con la que se dibuja un poste en el mapa. Crece con el zoom para que
 * se distinga sin acercarse de más, pero con tope: nunca domina el mapa.
 */
export function alturaPosteMapa(zoom: number): number {
  if (zoom <= ESCALA[0][0]) return ESCALA[0][1];
  const ultimo = ESCALA[ESCALA.length - 1];
  if (zoom >= ultimo[0]) return ultimo[1];
  const i = ESCALA.findIndex(([z]) => z > zoom);
  const [z0, a0] = ESCALA[i - 1];
  const [z1, a1] = ESCALA[i];
  return Math.round(a0 + ((a1 - a0) * (zoom - z0)) / (z1 - z0));
}

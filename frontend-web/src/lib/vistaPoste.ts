// frontend-web/src/lib/vistaPoste.ts
// Geometría pura del diagrama de poste (sin React ni DOM), para poder probarla.
import { DIMENSIONES_COMPONENTE } from "../pages/SpriteDefs";

/** Escala del dibujo: 12 m = 504 unidades (ver construirIconoPoste.ts). */
export const UNIDADES_POR_M = 42;

export type ModoVista = "herraje" | "completo";

export interface ComponenteUbicado {
  id: number;
  componente_visual_codigo: string;
  x: number;
  y: number;
}

export interface Vista {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Semiancho de la vista de herraje: deja sitio a la cruceta (±42), las retenidas (±55) y la regla lateral. */
const SEMIANCHO = 100;
const MARGEN_SUPERIOR = 40;
const MARGEN_INFERIOR = 24;
/** Mínimo visible bajo la punta en vista de herraje (≈ 2 m), aunque haya pocas piezas. */
const ALTO_MINIMO_HERRAJE = 90;
const HOLGURA_HERRAJE = 36;

/** Caja del componente (centrada en su x/y), o null si no se conoce su tamaño. */
export function cajaComponente(c: ComponenteUbicado): Vista | null {
  const dims = DIMENSIONES_COMPONENTE[c.componente_visual_codigo];
  if (!dims) return null;
  return { x: c.x - dims.ancho / 2, y: c.y - dims.alto / 2, ancho: dims.ancho, alto: dims.alto };
}

/**
 * `viewBox` del diagrama. "completo" muestra el poste entero; "herraje" se acerca a la
 * zona donde están las piezas (la punta del poste hasta la pieza más baja), que es
 * donde ocurre la edición y donde el dibujo completo las deja diminutas.
 */
export function vistaDiagrama(componentes: ComponenteUbicado[], modo: ModoVista, altoPoste: number): Vista {
  if (modo === "completo") {
    return {
      x: -(SEMIANCHO + 20),
      y: -MARGEN_SUPERIOR,
      ancho: (SEMIANCHO + 20) * 2,
      alto: altoPoste + MARGEN_SUPERIOR + MARGEN_INFERIOR,
    };
  }
  const cajas = componentes.map(cajaComponente).filter((c): c is Vista => c !== null);
  const arriba = Math.min(0, ...cajas.map((c) => c.y)) - HOLGURA_HERRAJE;
  const abajo = Math.max(ALTO_MINIMO_HERRAJE, ...cajas.map((c) => c.y + c.alto)) + HOLGURA_HERRAJE;
  const alto = Math.min(abajo, altoPoste + MARGEN_INFERIOR) - arriba;
  return { x: -SEMIANCHO, y: arriba, ancho: SEMIANCHO * 2, alto };
}

/** Altura sobre el piso (m) de un punto a `y` unidades de la punta; null si no se conoce el empotramiento. */
export function alturaSobrePisoM(y: number, alturaPosteM: number, empotramientoCm: number | null): number | null {
  if (empotramientoCm === null) return null;
  return alturaPosteM - empotramientoCm / 100 - y / UNIDADES_POR_M;
}

/** Orden único de las piezas (de arriba abajo, luego de izquierda a derecha) para numerarlas igual en diagrama y tabla. */
export function ordenarComponentes<T extends { x: number; y: number }>(componentes: T[]): T[] {
  return [...componentes].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Marcas de la regla lateral: una cada `pasoM` metros desde la punta, dentro del rango visible. */
export function marcasRegla(vista: Vista, altoPoste: number, pasoM = 0.5): { y: number; metros: number; mayor: boolean }[] {
  const marcas: { y: number; metros: number; mayor: boolean }[] = [];
  const maximo = Math.min(vista.y + vista.alto, altoPoste);
  for (let m = 0; m * UNIDADES_POR_M <= maximo; m += pasoM) {
    const y = m * UNIDADES_POR_M;
    if (y >= vista.y) marcas.push({ y, metros: m, mayor: Number.isInteger(m) });
  }
  return marcas;
}

import { describe, expect, it } from "vitest";
import { alturaSobrePisoM, cajaComponente, marcasRegla, ordenarComponentes, vistaDiagrama } from "./vistaPoste";

const ALTO_12M = 504;
// Piezas de una TS3N: cruceta y tres aisladores sobre ella.
const ts3n = [
  { id: 1, componente_visual_codigo: "cruceta", x: 0, y: 8.4 },
  { id: 2, componente_visual_codigo: "aislador_pin", x: -30, y: -5.6 },
  { id: 3, componente_visual_codigo: "aislador_pin", x: 0, y: -5.6 },
  { id: 4, componente_visual_codigo: "aislador_pin", x: 30, y: -5.6 },
];

describe("vistaDiagrama", () => {
  it("la vista completa abarca todo el poste", () => {
    const v = vistaDiagrama(ts3n, "completo", ALTO_12M);
    expect(v.y).toBeLessThan(0);
    expect(v.y + v.alto).toBeGreaterThan(ALTO_12M);
  });

  it("la vista de herraje es mucho más baja que la completa y contiene todas las piezas", () => {
    const completa = vistaDiagrama(ts3n, "completo", ALTO_12M);
    const herraje = vistaDiagrama(ts3n, "herraje", ALTO_12M);
    expect(herraje.alto).toBeLessThan(completa.alto / 2);
    for (const c of ts3n) {
      const caja = cajaComponente(c)!;
      expect(caja.y).toBeGreaterThanOrEqual(herraje.y);
      expect(caja.y + caja.alto).toBeLessThanOrEqual(herraje.y + herraje.alto);
      expect(caja.x).toBeGreaterThanOrEqual(herraje.x);
      expect(caja.x + caja.ancho).toBeLessThanOrEqual(herraje.x + herraje.ancho);
    }
  });

  it("se extiende hacia abajo para alcanzar piezas bajas, como las retenidas", () => {
    const conRetenida = [...ts3n, { id: 5, componente_visual_codigo: "retenida_ancla", x: 40, y: 58.8 }];
    const v = vistaDiagrama(conRetenida, "herraje", ALTO_12M);
    expect(v.y + v.alto).toBeGreaterThanOrEqual(58.8 + 32);
  });

  it("sin piezas conserva una altura mínima útil y no se sale del poste", () => {
    const v = vistaDiagrama([], "herraje", ALTO_12M);
    expect(v.alto).toBeGreaterThan(120);
    expect(v.y + v.alto).toBeLessThanOrEqual(ALTO_12M + 24);
  });

  it("ignora piezas sin dimensiones conocidas en lugar de fallar", () => {
    expect(() => vistaDiagrama([{ id: 9, componente_visual_codigo: "desconocida", x: 0, y: 0 }], "herraje", ALTO_12M)).not.toThrow();
  });
});

describe("alturaSobrePisoM", () => {
  it("resta empotramiento y distancia desde la punta", () => {
    // 12 m, 170 cm enterrados, cruceta a 0.2 m de la punta.
    expect(alturaSobrePisoM(0.2 * 42, 12, 170)).toBeCloseTo(12 - 1.7 - 0.2);
  });
  it("devuelve null si no se conoce el empotramiento", () => {
    expect(alturaSobrePisoM(10, 12, null)).toBeNull();
  });
});

describe("ordenarComponentes", () => {
  it("ordena de arriba abajo y luego de izquierda a derecha, sin mutar la entrada", () => {
    const entrada = [...ts3n];
    const ordenadas = ordenarComponentes(entrada);
    expect(ordenadas.map((c) => c.id)).toEqual([2, 3, 4, 1]);
    expect(entrada.map((c) => c.id)).toEqual([1, 2, 3, 4]);
  });
});

describe("marcasRegla", () => {
  it("marca cada medio metro desde la punta y destaca los metros enteros", () => {
    const marcas = marcasRegla({ x: -100, y: -40, ancho: 200, alto: 300 }, ALTO_12M);
    expect(marcas[0]).toMatchObject({ y: 0, metros: 0, mayor: true });
    expect(marcas[1]).toMatchObject({ metros: 0.5, mayor: false });
    expect(marcas.every((m) => m.y <= 260)).toBe(true);
  });
  it("no pasa del final del poste", () => {
    const marcas = marcasRegla({ x: -100, y: 400, ancho: 200, alto: 300 }, ALTO_12M);
    expect(Math.max(...marcas.map((m) => m.y))).toBeLessThanOrEqual(ALTO_12M);
  });
});

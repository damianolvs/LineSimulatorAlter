import { describe, expect, it } from "vitest";
import { alturaPosteMapa } from "./tamanoPosteMapa";

describe("alturaPosteMapa", () => {
  it("crece con el zoom", () => {
    const alturas = [12, 14, 15, 16, 17, 18, 19].map(alturaPosteMapa);
    expect(alturas).toEqual([...alturas].sort((a, b) => a - b));
    expect(alturaPosteMapa(17)).toBeGreaterThan(alturaPosteMapa(15));
  });

  it("es mayor que el icono fijo anterior (27 px) en los zoom de trabajo", () => {
    for (const zoom of [15, 16, 17, 18, 19]) expect(alturaPosteMapa(zoom)).toBeGreaterThan(27);
  });

  it("tiene tope y piso: no se vuelve enorme ni diminuto", () => {
    expect(alturaPosteMapa(3)).toBe(alturaPosteMapa(14));
    expect(alturaPosteMapa(22)).toBe(alturaPosteMapa(19));
    expect(alturaPosteMapa(22)).toBeLessThanOrEqual(64);
  });

  it("interpola entre puntos con zoom fraccionario", () => {
    const entre = alturaPosteMapa(16.5);
    expect(entre).toBeGreaterThan(alturaPosteMapa(16));
    expect(entre).toBeLessThan(alturaPosteMapa(17));
  });
});

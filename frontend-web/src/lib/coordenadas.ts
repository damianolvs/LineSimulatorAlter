// frontend-web/src/lib/coordenadas.ts

export type ResultadoPar =
  | { estado: "vacio" }
  | { estado: "error"; mensaje: string }
  | { estado: "ok"; lat: number; lng: number };

const GRADO = /^([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSEWO])?$/i;

type Eje = "latitud" | "longitud";

/** Grados decimales con hemisferio opcional: "28.63934", "-106.0996", "28.63934 N", "106.0996 O". */
function interpretarGrado(texto: string, eje: Eje): { valor: number } | { error: string } {
  const coincidencia = GRADO.exec(texto.trim());
  if (!coincidencia) return { error: `La ${eje} no es un número válido (usa grados decimales, p. ej. 28.63934).` };
  let valor = Number(coincidencia[1]);
  const hemisferio = coincidencia[2]?.toUpperCase();
  if (hemisferio) {
    const correcto = eje === "latitud" ? ["N", "S"] : ["E", "W", "O"];
    if (!correcto.includes(hemisferio)) return { error: `«${hemisferio}» no corresponde a una ${eje}.` };
    if (hemisferio === "S" || hemisferio === "W" || hemisferio === "O") valor = -Math.abs(valor);
  }
  const limite = eje === "latitud" ? 90 : 180;
  if (Math.abs(valor) > limite) return { error: `La ${eje} debe estar entre −${limite}° y ${limite}°.` };
  return { valor };
}

/** Valida un par de campos. Si ambos están vacíos no es un error: significa "no usar este punto". */
export function validarPar(lat: string, lng: string): ResultadoPar {
  if (!lat.trim() && !lng.trim()) return { estado: "vacio" };
  if (!lat.trim() || !lng.trim()) return { estado: "error", mensaje: "Falta la latitud o la longitud." };

  const la = interpretarGrado(lat, "latitud");
  const lo = interpretarGrado(lng, "longitud");
  if ("error" in la || "error" in lo) {
    // Latitud fuera de ±90 pero con una longitud plausible como latitud: casi seguro están invertidas.
    const numLat = Number(lat);
    const numLng = Number(lng);
    if ("error" in la && Math.abs(numLat) > 90 && Math.abs(numLng) <= 90) {
      return { estado: "error", mensaje: "¿Invertiste latitud y longitud? La latitud no puede pasar de 90°." };
    }
    return { estado: "error", mensaje: "error" in la ? la.error : (lo as { error: string }).error };
  }
  return { estado: "ok", lat: la.valor, lng: lo.valor };
}

/**
 * Si el texto pegado trae los dos valores ("28.63934, -106.0996" o "28.63934 -106.0996"),
 * los separa; si no, devuelve null y el campo se trata como un solo valor.
 */
export function separarPar(texto: string): { lat: string; lng: string } | null {
  const porComa = texto.split(/[,;]/).map((t) => t.trim());
  if (porComa.length === 2 && porComa[0] && porComa[1]) return { lat: porComa[0], lng: porComa[1] };
  const porEspacio = texto.trim().split(/\s+/);
  if (porEspacio.length === 2 && porEspacio.every((t) => GRADO.test(t))) return { lat: porEspacio[0], lng: porEspacio[1] };
  return null;
}

/** Texto de un grado para mostrar en un campo, sin ceros de relleno (6 decimales ≈ 0.1 m). */
export const gradoATexto = (valor: number) => String(Number(valor.toFixed(6)));

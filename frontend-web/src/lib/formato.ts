// frontend-web/src/lib/formato.ts
import type { EstadoProyecto } from "../api/tipos";

export const ETIQUETA_ESTADO: Record<EstadoProyecto, string> = {
  en_diseno: "En diseño",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  entregado: "Entregado",
  archivado: "Archivado",
};

/** Clase de `.tag` del sistema de diseño para cada estado. */
export const CLASE_ESTADO: Record<EstadoProyecto, string> = {
  en_diseno: "tag-accent",
  en_revision: "tag-neutral",
  aprobado: "tag-outline",
  entregado: "tag-neutral",
  archivado: "tag-neutral",
};

const numero = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export const formatearNumero = (n: number, decimales = 0) =>
  new Intl.NumberFormat("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n);

/** Cantidades de material: sin decimales si es entera, hasta 2 si no. */
export const formatearCantidad = (n: number) => numero.format(n);

export const formatearKm = (metros: number) => `${formatearNumero(metros / 1000, 2)} km`;

const hora = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
const diaMes = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" });

const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "hoy, 11:42" · "ayer, 18:05" · "11 sep 2026". */
export function formatearEdicion(iso: string, ahora = new Date()): string {
  const fecha = new Date(iso);
  const dias = Math.round((inicioDelDia(ahora) - inicioDelDia(fecha)) / 86_400_000);
  if (dias === 0) return `hoy, ${hora.format(fecha)}`;
  if (dias === 1) return `ayer, ${hora.format(fecha)}`;
  return diaMes.format(fecha).replace(/\./g, "");
}

export const formatearHora = (fecha: Date) => hora.format(fecha);

/** 28.63933° N, 106.09960° O */
export function formatearCoordenadas([lng, lat]: [number, number], decimales = 5): string {
  return `${Math.abs(lat).toFixed(decimales)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(decimales)}° ${lng >= 0 ? "E" : "O"}`;
}

/** Código de poste como en el mockup: P-05. */
export const codigoPoste = (orden: number) => `P-${String(orden).padStart(2, "0")}`;

/** "0°–5°", "15°–…", o "—" si la estructura no restringe la deflexión. */
export function formatearRangoAngulo(min: number | null, max: number | null): string {
  if (min === null && max === null) return "—";
  return `${min ?? 0}°–${max ?? "…"}°`;
}

export const ETIQUETA_CATEGORIA: Record<string, string> = {
  paso_simple: "Paso simple",
  paso_doble: "Paso doble / deflexión moderada",
  deflexion: "Deflexión",
  remate: "Remate",
  anclaje: "Anclaje en línea",
  subestacion: "Entrada/salida de subestación",
};

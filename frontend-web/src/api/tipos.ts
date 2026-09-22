// frontend-web/src/api/tipos.ts
import type { PosteComponenteDTO } from "../pages/construirIconoPoste";

export type TipoTerreno = "blando" | "normal" | "duro";

export type EstadoProyecto = "en_diseno" | "en_revision" | "aprobado" | "entregado" | "archivado";
export type TensionKv = 13.8 | 34.5;

export interface Proyecto {
  id: number;
  nombre: string;
  ubicacion: string;
  descripcion: string;
  estado: EstadoProyecto;
  tension_kv: TensionKv;
  creado_en: string;
  actualizado_en: string;
  tramo_ids: number[];
  num_postes: number;
  longitud_m: number;
}

export interface NuevoProyecto {
  nombre: string;
  ubicacion: string;
  descripcion: string;
  tension_kv: TensionKv;
  vano_maximo?: number;
}

export interface Tramo {
  id: number;
  proyecto: number;
  nombre: string;
  vano_maximo: number;
}

export interface EstructuraMTResumen {
  codigo: string;
  prefijo_codigo: string;
  categoria: string;
  angulo_min: number | null;
  angulo_max: number | null;
  es_terminal: boolean;
  verificado: boolean;
}

export interface EstructuraCFE {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  es_paso_estandar: boolean;
  /** Regla normativa asociada; null si la estructura aún no está digitalizada. */
  estructura_mt: EstructuraMTResumen | null;
}

export interface PrefijoEstructura {
  id: number;
  codigo: string;
  nombre: string;
}

export interface ComponenteVisual {
  id: number;
  codigo: string;
  nombre: string;
  ancho_px: number;
  alto_px: number;
  z_index: number;
}

export interface OpcionesPoste {
  alturas: { altura_m: number; resistencias_kg: number[] }[];
  terrenos: { codigo: TipoTerreno; nombre: string }[];
}

/** Componente colocado en un poste, tal como lo entrega el API. */
export interface PosteComponente extends PosteComponenteDTO {
  componente_visual: ComponenteVisual;
  regla_origen: number | null;
  /** Descripción y código del material de la regla que originó el componente; vacíos si lo agregó el usuario. */
  regla_descripcion: string;
  material_codigo: string;
  indice: number;
}

/** Campos editables de un poste (todo menos su geometría y componentes). */
export interface DatosPoste {
  estructura_id: number;
  altura_m: number;
  resistencia_kg: number;
  tipo_terreno: TipoTerreno;
}

export interface MaterialDesglose {
  regla_id: number;
  material: string;
  descripcion: string;
  cantidad: number;
  condicion: string;
  altura_sobre_piso_m: number;
  fuente: string | null;
  verificado: boolean;
}

export interface DesglosePoste {
  estructura: string;
  empotramiento_cm: number;
  materiales: MaterialDesglose[];
}

export interface Vano {
  id: number;
  poste_inicio: number;
  poste_fin: number;
  distancia: number;
}

export interface ListaMateriales {
  resumen: {
    num_postes: number;
    num_vanos: number;
    vano_promedio_m: number | null;
    longitud_m: number;
    piezas: number;
    partidas: number;
    partidas_sin_verificar: number;
  };
  postes: { altura_m: number; resistencia_kg: number; cantidad: number }[];
  materiales: {
    codigo: string;
    nombre: string;
    unidad: string;
    cantidad: number;
    verificado: boolean;
    cantidad_estimada: boolean;
  }[];
  por_poste: {
    poste_id: number;
    orden: number;
    estructura: string;
    altura_m: number;
    resistencia_kg: number;
    materiales: { material: string; codigo: string; unidad: string; cantidad: number; verificado: boolean }[];
  }[];
  /** Postes cuya estructura aún no tiene reglas normativas: no entran en la lista. */
  sin_reglas: { poste_id: number; orden: number; estructura: string }[];
}

/** Material que lleva una estructura según su regla normativa. */
export interface MaterialEstructura {
  material_nombre: string;
  material_codigo: string;
  descripcion: string;
  cantidad: number;
  condicion: string;
  cantidad_estimada: boolean;
  verificado: boolean;
  fuente_codigo: string;
}

/** Estructura del catálogo CFE con su normativa (sección 05 del documento fuente). */
export interface EstructuraNormativa {
  id: number;
  codigo: string;
  nombre: string;
  prefijo_codigo: string;
  categoria: string;
  angulo_min: number | null;
  angulo_max: number | null;
  es_terminal: boolean;
  descripcion: string;
  verificado: boolean;
  fuente_codigo: string;
  fuente_titulo: string;
  fuente_pagina: number | null;
  materiales: MaterialEstructura[];
}

export interface MaterialCatalogo {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  cantidad_estimada: boolean;
  /** Pieza con la que se dibuja este material sobre el poste; null si no se dibuja. */
  componente_visual_codigo: string | null;
}

// frontend-web/src/api/proyectos.ts
import { api } from "./cliente";
import type {
  ComponenteVisual,
  DatosPoste,
  DesglosePoste,
  EstructuraCFE,
  ListaMateriales,
  NuevoProyecto,
  OpcionesPoste,
  PosteComponente,
  PrefijoEstructura,
  Proyecto,
  Tramo,
  Vano,
} from "./tipos";

type DatosPosteLeido = Omit<DatosPoste, "estructura_id">;

/** Poste tal cual lo entrega el API (GeoJSON Feature con `id` dentro de `properties`). */
export interface PosteFeature {
  geometry: { coordinates: [number, number] };
  properties: DatosPosteLeido & {
    id: number;
    tramo: number;
    orden: number;
    es_ancla: boolean;
    empotramiento_cm: number | null;
    angulo_deflexion: number | null;
    estructura: EstructuraCFE;
    componentes: PosteComponente[];
  };
}

// --- Proyectos y tramos ---------------------------------------------------

export const listarProyectos = () => api<Proyecto[]>("/api/proyectos/proyectos/");
export const obtenerProyecto = (id: number | string) => api<Proyecto>(`/api/proyectos/proyectos/${id}/`);
export const crearProyecto = (datos: NuevoProyecto) =>
  api<Proyecto>("/api/proyectos/proyectos/", { method: "POST", json: datos });

export const actualizarProyecto = (id: number, cambios: Partial<Pick<Proyecto, "nombre" | "estado" | "tension_kv">>) =>
  api<Proyecto>(`/api/proyectos/proyectos/${id}/`, { method: "PATCH", json: cambios });
export const obtenerMateriales = (proyectoId: number | string) =>
  api<ListaMateriales>(`/api/proyectos/proyectos/${proyectoId}/materiales/`);

export const actualizarTramo = (id: number, cambios: { vano_maximo: number }) =>
  api<unknown>(`/api/proyectos/tramos/${id}/`, { method: "PATCH", json: { properties: cambios } });

/** El listado de tramos viene como FeatureCollection; aquí solo interesan sus propiedades. */
export const listarTramos = async (proyectoId: number | string): Promise<Tramo[]> => {
  const { features } = await api<{ features: { properties: Tramo }[] }>(
    `/api/proyectos/tramos/?proyecto=${proyectoId}`,
  );
  return features.map((f) => f.properties);
};

export const generarPostesDePaso = (tramoId: number, estructuraId?: number) =>
  api<unknown>(`/api/proyectos/tramos/${tramoId}/generar-postes-de-paso/`, {
    method: "POST",
    json: estructuraId ? { estructura_id: estructuraId } : {},
  });

export const generarVanos = (tramoId: number) =>
  api<Vano[]>(`/api/proyectos/tramos/${tramoId}/generar-vanos/`, { method: "POST", json: {} });

// --- Postes ---------------------------------------------------------------

export const listarPostes = async (tramoId: number | string, signal?: AbortSignal) => {
  const { features } = await api<{ features: PosteFeature[] }>(`/api/proyectos/postes/?tramo=${tramoId}`, { signal });
  return features;
};

/** [lng, lat] — el orden de GeoJSON. */
export const crearPoste = (tramoId: number, [lng, lat]: [number, number], datos: DatosPoste, esAncla = true) =>
  api<PosteFeature>("/api/proyectos/postes/", {
    method: "POST",
    json: {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { tramo: tramoId, es_ancla: esAncla, ...datos },
    },
  });

export const actualizarPoste = (id: number, propiedades: Partial<DatosPoste>) =>
  api<PosteFeature>(`/api/proyectos/postes/${id}/`, { method: "PATCH", json: { properties: propiedades } });

export const moverPoste = (id: number, [lng, lat]: [number, number]) =>
  api<PosteFeature>(`/api/proyectos/postes/${id}/`, {
    method: "PATCH",
    json: { geometry: { type: "Point", coordinates: [lng, lat] }, properties: {} },
  });

export const borrarPoste = (id: number) => api<void>(`/api/proyectos/postes/${id}/`, { method: "DELETE" });

export const resolverLayout = (posteId: number) =>
  api<PosteComponente[]>(`/api/proyectos/postes/${posteId}/resolver-layout/`, { method: "POST", json: {} });

export const obtenerDesglose = (posteId: number) => api<DesglosePoste>(`/api/proyectos/postes/${posteId}/desglose/`);

// --- Componentes de un poste ---------------------------------------------

const rutaComponentes = (posteId: number) => `/api/proyectos/postes/${posteId}/componentes/`;

export const crearComponente = (posteId: number, componenteVisualId: number, x: number, y: number) =>
  api<PosteComponente>(rutaComponentes(posteId), {
    method: "POST",
    json: { componente_visual_id: componenteVisualId, x, y },
  });

export const actualizarComponente = (
  posteId: number,
  id: number,
  cambios: Partial<Pick<PosteComponente, "x" | "y" | "rotacion" | "espejo" | "orden_z">>,
) => api<PosteComponente>(`${rutaComponentes(posteId)}${id}/`, { method: "PATCH", json: cambios });

export const borrarComponente = (posteId: number, id: number) =>
  api<void>(`${rutaComponentes(posteId)}${id}/`, { method: "DELETE" });

// --- Catálogo y normativa -------------------------------------------------

export const listarEstructuras = () => api<EstructuraCFE[]>("/api/catalogo/estructuras/");
export const listarComponentesVisuales = () => api<ComponenteVisual[]>("/api/catalogo/componentes-visuales/");
export const listarPrefijos = () => api<PrefijoEstructura[]>("/api/reglas/prefijos-estructura/");
export const obtenerOpcionesPoste = () => api<OpcionesPoste>("/api/reglas/opciones-poste/");

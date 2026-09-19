// frontend-web/src/hooks/useTramoConPostes.ts
import { useCallback, useEffect, useState } from "react";
import { listarPostes, type PosteFeature } from "../api/proyectos";
import type { EstructuraCFE, PosteComponente, TipoTerreno } from "../api/tipos";
import { construirIconoPoste, type IconoPoste } from "../pages/construirIconoPoste";

export interface PosteConIcono {
  id: number;
  orden: number;
  esAncla: boolean;
  /** [lng, lat], tal cual lo entrega el geom del backend. */
  posicion: [number, number];
  anguloDeflexion: number | null;
  estructura: EstructuraCFE;
  alturaM: number;
  resistenciaKg: number;
  tipoTerreno: TipoTerreno;
  empotramientoCm: number | null;
  componentes: PosteComponente[];
  icono: IconoPoste;
}

function mapearPoste({ properties, geometry }: PosteFeature): PosteConIcono {
  return {
    id: properties.id,
    orden: properties.orden,
    esAncla: properties.es_ancla,
    posicion: geometry.coordinates,
    anguloDeflexion: properties.angulo_deflexion,
    estructura: properties.estructura,
    alturaM: properties.altura_m,
    resistenciaKg: properties.resistencia_kg,
    tipoTerreno: properties.tipo_terreno,
    empotramientoCm: properties.empotramiento_cm,
    componentes: properties.componentes,
    icono: construirIconoPoste(properties.componentes),
  };
}

/**
 * Trae los postes reales de un tramo (con sus componentes visuales ya
 * resueltos a íconos) para pintarlos en MapaTramo.tsx. `recargar` vuelve a
 * pedirlos, p. ej. tras crear, mover o editar un poste.
 */
export function useTramoConPostes(tramoId: number | string | undefined) {
  const [postes, setPostes] = useState<PosteConIcono[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (tramoId === undefined) return;

    const controller = new AbortController();
    setCargando(true);
    setError(null);

    listarPostes(tramoId, controller.signal)
      .then((features) => setPostes(features.map(mapearPoste)))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setCargando(false));

    return () => controller.abort();
  }, [tramoId, version]);

  return { postes, cargando, error, recargar };
}

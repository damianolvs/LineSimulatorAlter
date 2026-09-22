// frontend-web/src/components/MapaTramo.tsx
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polyline, ScaleControl, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { PosteConIcono } from "../hooks/useTramoConPostes";
import { codigoPoste } from "../lib/formato";
import { distanciaM } from "../lib/geo";
import { iconoPosteMapa, iconoVano } from "../lib/iconoPosteMapa";

export type BaseMapa = "satelite" | "hibrido" | "topografico";
export type Herramienta = "seleccionar" | "trazar" | "poste";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

export const BASES: Record<BaseMapa, { nombre: string; etiqueta: string; capas: string[] }> = {
  satelite: { nombre: "Esri World Imagery", etiqueta: "Satélite", capas: [`${ESRI}/World_Imagery/MapServer`] },
  hibrido: {
    nombre: "Esri World Imagery + etiquetas",
    etiqueta: "Híbrido",
    capas: [`${ESRI}/World_Imagery/MapServer`, `${ESRI}/Reference/World_Boundaries_and_Places/MapServer`],
  },
  topografico: { nombre: "Esri World Topo Map", etiqueta: "Topográfico", capas: [`${ESRI}/World_Topo_Map/MapServer`] },
};

/** Centro por defecto (Chihuahua, zona UTM 13N con la que calcula el backend) mientras el tramo no tiene postes. */
const CENTRO_INICIAL: [number, number] = [28.63, -106.07];

interface Props {
  postes: PosteConIcono[];
  seleccionadoId: number | null;
  herramienta: Herramienta;
  base: BaseMapa;
  onCambiarBase: (base: BaseMapa) => void;
  mostrarVanos: boolean;
  mostrarEtiquetas: boolean;
  onSeleccionar: (id: number) => void;
  /** [lng, lat] */
  onColocar: (posicion: [number, number]) => void;
  onMover: (id: number, posicion: [number, number]) => void;
  /** Centro actual del mapa como [lng, lat], para el pie del panel de herramientas. */
  onCentro: (centro: [number, number]) => void;
  /** Pide encuadrar puntos ([lng, lat]) en el mapa; cada valor nuevo de `clave` dispara un encuadre. */
  enfoque: { clave: number; puntos: [number, number][] } | null;
}

const aLatLng = ([lng, lat]: [number, number]): [number, number] => [lat, lng];

function ClicColocar({ activo, onColocar }: { activo: boolean; onColocar: Props["onColocar"] }) {
  useMapEvents({
    click(e) {
      // Al desplazar el mapa más allá de una vuelta al mundo Leaflet da longitudes fuera de ±180°; se normalizan.
      const { lat, lng } = e.latlng.wrap();
      if (activo) onColocar([lng, lat]);
    },
  });
  return null;
}

function SeguirCentro({ onCentro }: { onCentro: Props["onCentro"] }) {
  const map = useMap();
  useEffect(() => {
    const avisar = () => {
      const { lat, lng } = map.getCenter().wrap();
      onCentro([lng, lat]);
    };
    avisar();
    map.on("moveend", avisar);
    return () => {
      map.off("moveend", avisar);
    };
  }, [map, onCentro]);
  return null;
}

/** Encuadra los postes la primera vez que llegan, sin volver a mover la vista en cada recarga. */
function AjustarVista({ postes }: { postes: PosteConIcono[] }) {
  const map = useMap();
  const ajustado = useRef(false);
  useEffect(() => {
    if (ajustado.current || postes.length === 0) return;
    ajustado.current = true;
    map.fitBounds(L.latLngBounds(postes.map((p) => aLatLng(p.posicion))), { padding: [60, 60], maxZoom: 17 });
  }, [postes, map]);
  return null;
}

/** Lleva la vista a los puntos pedidos: un punto se centra acercando; varios se encuadran. */
function EnfocarVista({ enfoque }: { enfoque: Props["enfoque"] }) {
  const map = useMap();
  const clave = enfoque?.clave;
  useEffect(() => {
    if (!enfoque || enfoque.puntos.length === 0) return;
    if (enfoque.puntos.length === 1) {
      map.flyTo(aLatLng(enfoque.puntos[0]), Math.max(map.getZoom(), 16));
    } else {
      map.fitBounds(L.latLngBounds(enfoque.puntos.map(aLatLng)), { padding: [60, 60], maxZoom: 17 });
    }
    // Solo cuando llega una petición nueva, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, map]);
  return null;
}

/** Controles del mapa con el aspecto del mockup: zoom arriba a la izquierda, selector de base arriba a la derecha. */
function ControlesMapa({ base, onCambiarBase }: Pick<Props, "base" | "onCambiarBase">) {
  const map = useMap();
  const zoom = useRef<HTMLDivElement>(null);
  const selector = useRef<HTMLDivElement>(null);

  // Que arrastrar o pulsar los controles no mueva el mapa que hay debajo.
  useEffect(() => {
    for (const el of [zoom.current, selector.current]) {
      if (el) {
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.disableScrollPropagation(el);
      }
    }
  }, []);

  const paso = "grid h-8 w-[34px] cursor-pointer place-items-center bg-transparent text-[17px]";
  return (
    <>
      <div
        ref={zoom}
        className="absolute left-3.5 top-3.5 z-[1000] flex flex-col overflow-hidden"
        style={{
          background: "color-mix(in srgb, var(--color-bg) 94%, transparent)",
          border: "1px solid var(--color-divider)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <button type="button" aria-label="Acercar" className={paso} style={{ fontFamily: "var(--font-heading)" }} onClick={() => map.zoomIn()}>
          +
        </button>
        <button
          type="button"
          aria-label="Alejar"
          className={paso}
          style={{ fontFamily: "var(--font-heading)", borderTop: "1px solid var(--color-divider)" }}
          onClick={() => map.zoomOut()}
        >
          −
        </button>
      </div>

      <div
        ref={selector}
        className="seg absolute right-3.5 top-3.5 z-[1000]"
        style={{ background: "color-mix(in srgb, var(--color-bg) 94%, transparent)", boxShadow: "var(--shadow-sm)" }}
      >
        {(Object.keys(BASES) as BaseMapa[]).map((clave) => (
          <label key={clave} className="seg-opt">
            <input type="radio" name="base-mapa" checked={base === clave} onChange={() => onCambiarBase(clave)} />
            {BASES[clave].etiqueta}
          </label>
        ))}
      </div>
    </>
  );
}

export default function MapaTramo({
  postes,
  seleccionadoId,
  herramienta,
  base,
  onCambiarBase,
  mostrarVanos,
  mostrarEtiquetas,
  onSeleccionar,
  onColocar,
  onMover,
  onCentro,
  enfoque,
}: Props) {
  const ordenados = useMemo(() => [...postes].sort((a, b) => a.orden - b.orden), [postes]);
  const linea = ordenados.map((p) => aLatLng(p.posicion));
  const colocando = herramienta !== "seleccionar";

  const vanos = useMemo(
    () =>
      ordenados.slice(1).map((siguiente, i) => {
        const anterior = ordenados[i];
        return {
          clave: `${anterior.id}-${siguiente.id}`,
          metros: distanciaM(anterior.posicion, siguiente.posicion),
          medio: [(anterior.posicion[1] + siguiente.posicion[1]) / 2, (anterior.posicion[0] + siguiente.posicion[0]) / 2] as [
            number,
            number,
          ],
          resaltado: anterior.id === seleccionadoId || siguiente.id === seleccionadoId,
        };
      }),
    [ordenados, seleccionadoId],
  );

  return (
    // MapContainer no actualiza su className tras montarse, por eso el modo va en un contenedor aparte.
    <div className={`relative h-full w-full ${colocando ? "mapa-colocando" : ""}`}>
      <MapContainer center={CENTRO_INICIAL} zoom={13} zoomControl={false} className="h-full w-full">
        {BASES[base].capas.map((capa) => (
          <TileLayer key={capa} url={`${capa}/tile/{z}/{y}/{x}`} attribution="Tiles &copy; Esri" maxZoom={19} />
        ))}
        <AjustarVista postes={postes} />
        <SeguirCentro onCentro={onCentro} />
        <EnfocarVista enfoque={enfoque} />
        <ClicColocar activo={colocando} onColocar={onColocar} />
        <ControlesMapa base={base} onCambiarBase={onCambiarBase} />
        <ScaleControl position="bottomleft" imperial={false} />

        {linea.length > 1 && (
          <>
            {/* Trayectoria: sombra oscura, línea crema y trazo dorado punteado encima. */}
            <Polyline
              positions={linea}
              pathOptions={{ color: "#1d1b18", opacity: 0.55, weight: 7, lineCap: "round", lineJoin: "round" }}
              interactive={false}
            />
            <Polyline
              positions={linea}
              pathOptions={{ color: "#f0e2c8", weight: 2.4, lineCap: "round", lineJoin: "round" }}
              interactive={false}
            />
            <Polyline
              positions={linea}
              pathOptions={{ color: "#b68235", weight: 2.4, dashArray: "14 12", lineCap: "round" }}
              interactive={false}
            />
          </>
        )}

        {mostrarVanos &&
          vanos.map((v) => (
            <Marker key={v.clave} position={v.medio} icon={iconoVano(v.metros, v.resaltado)} interactive={false} />
          ))}

        {ordenados.map((p) => {
          const seleccionado = p.id === seleccionadoId;
          const mostrarTexto = mostrarEtiquetas && (seleccionado || p.esAncla);
          return (
            <Marker
              key={p.id}
              position={aLatLng(p.posicion)}
              icon={iconoPosteMapa({
                componentes: p.componentes,
                seleccionado,
                etiqueta: mostrarTexto ? `${codigoPoste(p.orden)} · ${p.estructura.codigo}` : "",
              })}
              zIndexOffset={seleccionado ? 1000 : 0}
              draggable={herramienta === "seleccionar"}
              title={`${codigoPoste(p.orden)} · ${p.estructura.codigo}`}
              eventHandlers={{
                click: () => onSeleccionar(p.id),
                dragend: (e) => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng().wrap();
                  onMover(p.id, [lng, lat]);
                },
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}

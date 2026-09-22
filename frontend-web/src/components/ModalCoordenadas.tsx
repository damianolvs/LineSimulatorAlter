// frontend-web/src/components/ModalCoordenadas.tsx
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { EstructuraCFE, PrefijoEstructura } from "../api/tipos";
import { validarPar } from "../lib/coordenadas";
import { formatearNumero } from "../lib/formato";
import { distanciaM } from "../lib/geo";
import CampoCoordenadas from "./CampoCoordenadas";
import SelectorEstructura from "./SelectorEstructura";

interface Fila {
  id: number;
  lat: string;
  lng: string;
}

interface Props {
  /** Tramo sin postes: las filas se etiquetan Inicio / Fin. Con postes, se agregan a continuación del último. */
  tramoVacio: boolean;
  /** Código del último poste del tramo, para explicar dónde se agregan (p. ej. "P-04"). */
  ultimoPoste: string | null;
  estructuras: EstructuraCFE[];
  prefijos: PrefijoEstructura[];
  estructuraInicialId: number | null;
  /** Crea los postes; debe lanzar si falla, para mostrar el error aquí mismo. Puntos como [lng, lat]. */
  onCrear: (puntos: [number, number][], estructuraId: number) => Promise<void>;
  onCerrar: () => void;
}

let siguienteId = 0;
const nuevaFila = (): Fila => ({ id: ++siguienteId, lat: "", lng: "" });

export default function ModalCoordenadas({
  tramoVacio,
  ultimoPoste,
  estructuras,
  prefijos,
  estructuraInicialId,
  onCrear,
  onCerrar,
}: Props) {
  const [filas, setFilas] = useState<Fila[]>(() => (tramoVacio ? [nuevaFila(), nuevaFila()] : [nuevaFila()]));
  const [estructuraId, setEstructuraId] = useState<number | null>(estructuraInicialId);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  const resultados = filas.map((f) => validarPar(f.lat, f.lng));
  const validos = resultados.flatMap((r, i) => (r.estado === "ok" ? [{ indice: i, lat: r.lat, lng: r.lng }] : []));
  const hayErrores = resultados.some((r) => r.estado === "error");

  // Distancia de cada punto al anterior que sí se va a crear, para detectar dedazos (un dígito de más) al vuelo.
  const distancias = useMemo(() => {
    const mapa = new Map<number, number>();
    validos.forEach((p, k) => {
      if (k > 0) mapa.set(p.indice, distanciaM([validos[k - 1].lng, validos[k - 1].lat], [p.lng, p.lat]));
    });
    return mapa;
  }, [validos]);

  const etiqueta = (i: number) => {
    if (!tramoVacio) return `Punto ${i + 1}`;
    if (i === 0) return "Inicio";
    if (i === filas.length - 1) return "Fin";
    return `Intermedio ${i}`;
  };
  const puedeQuitar = (i: number) => (tramoVacio ? i > 0 && i < filas.length - 1 : filas.length > 1);

  const cambiar = (id: number, lat: string, lng: string) =>
    setFilas((actual) => actual.map((f) => (f.id === id ? { ...f, lat, lng } : f)));

  const agregar = () =>
    setFilas((actual) =>
      tramoVacio ? [...actual.slice(0, -1), nuevaFila(), actual[actual.length - 1]] : [...actual, nuevaFila()],
    );

  const crear = async () => {
    if (validos.length === 0 || hayErrores || estructuraId === null) return;
    setCreando(true);
    setError(null);
    try {
      await onCrear(
        validos.map((p) => [p.lng, p.lat] as [number, number]),
        estructuraId,
      );
      onCerrar();
    } catch (err) {
      setError((err as Error).message);
      setCreando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] grid place-items-center p-[34px]"
      style={{ background: "color-mix(in srgb, #2d2b2b 55%, transparent)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ingresar postes por coordenadas"
        className="flex w-[680px] max-w-full flex-col overflow-hidden"
        style={{
          maxHeight: "calc(100vh - 68px)",
          background: "var(--color-bg)",
          border: "1px solid var(--color-divider)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="flex items-start gap-3 px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-divider)", background: "var(--color-neutral-100)" }}
        >
          <div>
            <div className="card-kicker">Ubicación por coordenadas</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, lineHeight: 1.1 }}>Ingresar postes</div>
          </div>
          <button type="button" className="btn btn-ghost ml-auto" aria-label="Cerrar" onClick={onCerrar}>
            <X size={17} strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-auto px-6 py-5">
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            Todo es opcional: deja vacío lo que no necesites. Grados decimales (latitud, longitud); también puedes pegar
            «28.63934, -106.0996» en cualquiera de los campos.{" "}
            {tramoVacio
              ? "Con inicio y fin basta: después generas los postes de paso."
              : `Los puntos se agregan a continuación del poste ${ultimoPoste ?? "final"}.`}
          </p>

          <div className="field">
            <label htmlFor="coord-estructura">Estructura de estos postes</label>
            <SelectorEstructura
              id="coord-estructura"
              aria-label="Estructura de los postes nuevos"
              estructuras={estructuras}
              prefijos={prefijos}
              valor={estructuraId}
              disabled={creando}
              onCambiar={setEstructuraId}
            />
          </div>

          <div className="flex flex-col gap-2.5">
            {filas.map((f, i) => {
              const r = resultados[i];
              const distancia = distancias.get(i);
              return (
                <div key={f.id}>
                  <div className="grid items-center gap-2" style={{ gridTemplateColumns: "104px 1fr 1fr 32px" }}>
                    <span style={{ fontFamily: "var(--font-heading)", fontSize: 16 }}>{etiqueta(i)}</span>
                    <CampoCoordenadas
                      etiqueta={etiqueta(i)}
                      lat={f.lat}
                      lng={f.lng}
                      disabled={creando}
                      onChange={(lat, lng) => cambiar(f.id, lat, lng)}
                      onEnter={crear}
                    />
                    {puedeQuitar(i) ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        style={{ width: 32, height: 32 }}
                        aria-label={`Quitar ${etiqueta(i)}`}
                        disabled={creando}
                        onClick={() => setFilas((actual) => actual.filter((x) => x.id !== f.id))}
                      >
                        <X size={15} strokeWidth={1.8} />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                  {r.estado === "error" && (
                    <div role="alert" style={{ marginLeft: 112, fontSize: 12, color: "var(--color-accent-700)" }}>
                      {r.mensaje}
                    </div>
                  )}
                  {distancia !== undefined && (
                    <div className="text-muted num" style={{ marginLeft: 112, fontSize: 11.5 }}>
                      a {formatearNumero(distancia)} m del punto anterior
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <button type="button" className="btn btn-secondary" disabled={creando} onClick={agregar}>
              <Plus size={14} strokeWidth={2} />
              {tramoVacio ? "Agregar punto intermedio" : "Agregar punto"}
            </button>
          </div>

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--color-accent-700)" }}>
              {error}
            </p>
          )}
        </div>

        <div
          className="flex items-center gap-3 px-6 py-3.5"
          style={{ borderTop: "1px solid var(--color-divider)", background: "var(--color-neutral-100)" }}
        >
          <span className="text-muted" style={{ fontSize: 12.5 }}>
            Se crean como postes ancla.
          </span>
          <div className="ml-auto flex gap-2.5">
            <button type="button" className="btn btn-secondary" onClick={onCerrar}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={creando || hayErrores || validos.length === 0 || estructuraId === null}
              onClick={crear}
            >
              {creando ? "Creando…" : validos.length === 0 ? "Crear postes" : `Crear ${validos.length} ${validos.length === 1 ? "poste" : "postes"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

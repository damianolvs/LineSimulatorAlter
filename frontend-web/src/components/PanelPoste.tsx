// frontend-web/src/components/PanelPoste.tsx
import { Pencil, Trash2 } from "lucide-react";
import type { DatosPoste, EstructuraCFE, OpcionesPoste, PrefijoEstructura } from "../api/tipos";
import type { PosteConIcono } from "../hooks/useTramoConPostes";
import { codigoPoste, formatearCoordenadas, formatearNumero } from "../lib/formato";
import { ETIQUETA_CATEGORIA } from "./SelectorEstructura";
import SelectorEstructura from "./SelectorEstructura";

interface Props {
  poste: PosteConIcono;
  estructuras: EstructuraCFE[];
  prefijos: PrefijoEstructura[];
  opciones: OpcionesPoste;
  /** Distancias a los postes vecinos en metros; null en los extremos de la línea. */
  vanoAnteriorM: number | null;
  vanoSiguienteM: number | null;
  ocupado: boolean;
  onCambiar: (cambios: Partial<DatosPoste>) => void;
  onConfigurar: () => void;
  onAplicarATramo: () => void;
  onEliminar: () => void;
}

/** Texto bajo el selector: si la deflexión real encaja o no con el rango que admite la estructura. */
function notaDeflexion(poste: PosteConIcono): { texto: string; alerta: boolean } | null {
  const angulo = poste.anguloDeflexion;
  const mt = poste.estructura.estructura_mt;
  if (angulo === null) return null;
  if (!mt || (mt.angulo_min === null && mt.angulo_max === null)) {
    return { texto: `Deflexión de ${angulo.toFixed(1)}°`, alerta: false };
  }
  const rango = `${mt.angulo_min ?? 0}°–${mt.angulo_max ?? "…"}°`;
  const fuera = (mt.angulo_min !== null && angulo < mt.angulo_min) || (mt.angulo_max !== null && angulo > mt.angulo_max);
  return fuera
    ? { texto: `Deflexión de ${angulo.toFixed(1)}°: fuera del rango de ${mt.codigo} (${rango})`, alerta: true }
    : { texto: `Deflexión de ${angulo.toFixed(1)}°: dentro del rango de ${mt.codigo} (${rango})`, alerta: false };
}

const fila = "flex items-center gap-2 px-[9px] py-1.5 text-[13px]";

export default function PanelPoste({
  poste,
  estructuras,
  prefijos,
  opciones,
  vanoAnteriorM,
  vanoSiguienteM,
  ocupado,
  onCambiar,
  onConfigurar,
  onAplicarATramo,
  onEliminar,
}: Props) {
  const resistencias = opciones.alturas.find((a) => a.altura_m === poste.alturaM)?.resistencias_kg ?? [];
  // Una combinación que la tabla no lista se conserva como opción para no ocultar el dato real.
  const alturas = [...new Set([...opciones.alturas.map((a) => a.altura_m), poste.alturaM])].sort((a, b) => a - b);
  const resistenciasVisibles = [...new Set([...resistencias, poste.resistenciaKg])].sort((a, b) => a - b);

  const cambiarAltura = (altura: number) => {
    const disponibles = opciones.alturas.find((a) => a.altura_m === altura)?.resistencias_kg ?? [];
    onCambiar({
      altura_m: altura,
      // La tabla asocia cada altura a su resistencia; se ajusta junto con ella.
      ...(disponibles.length && !disponibles.includes(poste.resistenciaKg) ? { resistencia_kg: disponibles[0] } : {}),
    });
  };

  const nota = notaDeflexion(poste);
  const mt = poste.estructura.estructura_mt;

  // Herrajes agrupados por tipo de componente; "manual" si alguna pieza del grupo se ajustó a mano.
  const herrajes = [...poste.componentes.reduce((grupos, c) => {
    const previo = grupos.get(c.componente_visual_codigo);
    grupos.set(c.componente_visual_codigo, {
      nombre: c.componente_visual.nombre,
      cantidad: (previo?.cantidad ?? 0) + 1,
      manual: (previo?.manual ?? false) || c.modo === "manual",
    });
    return grupos;
  }, new Map<string, { nombre: string; cantidad: number; manual: boolean }>()).entries()];

  const geometria: [string, string][] = [
    ["Vano anterior", vanoAnteriorM === null ? "—" : `${formatearNumero(vanoAnteriorM, 1)} m`],
    ["Vano siguiente", vanoSiguienteM === null ? "—" : `${formatearNumero(vanoSiguienteM, 1)} m`],
    ["Ángulo de deflexión", poste.anguloDeflexion === null ? "—" : `${poste.anguloDeflexion.toFixed(1)}°`],
    ["Empotramiento", poste.empotramientoCm === null ? "—" : `${poste.empotramientoCm} cm`],
  ];

  return (
    <>
      <div
        className="flex items-center gap-2.5 px-[18px] pb-3 pt-3.5"
        style={{ borderBottom: "1px solid var(--color-divider)" }}
      >
        <svg width="20" height="30" viewBox="0 0 17 27" aria-hidden="true">
          <rect x="7.2" y="3" width="2.6" height="22.4" fill="url(#metalV)" stroke="#2a2724" strokeWidth=".5" />
          <rect x="1.6" y="5.2" width="13.8" height="2" rx=".5" fill="url(#metalH)" stroke="#2a2724" strokeWidth=".5" />
          {[2.6, 8.5, 14.4].map((cx) => (
            <circle key={cx} cx={cx} cy="4" r="1.5" fill="url(#glass)" stroke="#2a2724" strokeWidth=".4" />
          ))}
        </svg>
        <div className="min-w-0">
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 19, lineHeight: 1.1 }}>
            Poste {codigoPoste(poste.orden)}
          </div>
          <div className="text-muted num truncate" style={{ fontSize: 11 }}>
            {formatearCoordenadas(poste.posicion, 5)}
          </div>
        </div>
        <span className="tag tag-outline ml-auto">{poste.esAncla ? "Ancla" : "Paso"}</span>
      </div>

      <div className="flex flex-col gap-4 overflow-auto px-[18px] py-4">
        <div className="field">
          <label htmlFor="panel-estructura">Tipo de estructura (CFE)</label>
          <SelectorEstructura
            id="panel-estructura"
            aria-label="Tipo de estructura"
            estructuras={estructuras}
            prefijos={prefijos}
            valor={poste.estructura.id}
            disabled={ocupado}
            onCambiar={(id) => onCambiar({ estructura_id: id })}
          />
          <div
            className="text-muted"
            style={{ fontSize: 11, marginTop: 5, color: nota?.alerta ? "var(--color-accent-700)" : undefined }}
          >
            {mt
              ? `${ETIQUETA_CATEGORIA[mt.categoria] ?? mt.categoria}${mt.es_terminal ? " · terminal" : ""}${mt.verificado ? "" : " · reglas por verificar"}`
              : "Sin reglas normativas: no genera componentes ni materiales"}
            {nota && <div>{nota.texto}</div>}
          </div>
        </div>

        <div>
          <h6 style={{ margin: "0 0 8px" }}>Geometría del tramo</h6>
          <table className="table" style={{ fontSize: 13 }}>
            <tbody>
              {geometria.map(([nombre, valor], i) => (
                <tr key={nombre}>
                  <td style={{ paddingLeft: 0, borderBottom: i === geometria.length - 1 ? 0 : undefined }}>{nombre}</td>
                  <td
                    className="num"
                    style={{ textAlign: "right", paddingRight: 0, borderBottom: i === geometria.length - 1 ? 0 : undefined }}
                  >
                    {valor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h6 style={{ margin: "0 0 8px" }}>Poste</h6>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="field">
              <label htmlFor="panel-altura">Altura (m)</label>
              <select
                id="panel-altura"
                className="input num"
                disabled={ocupado}
                value={poste.alturaM}
                onChange={(e) => cambiarAltura(Number(e.target.value))}
              >
                {alturas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="panel-resistencia">Resistencia (kg)</label>
              <select
                id="panel-resistencia"
                className="input num"
                disabled={ocupado}
                value={poste.resistenciaKg}
                onChange={(e) => onCambiar({ resistencia_kg: Number(e.target.value) })}
              >
                {resistenciasVisibles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field col-span-2">
              <label htmlFor="panel-terreno">Tipo de terreno</label>
              <select
                id="panel-terreno"
                className="input"
                disabled={ocupado}
                value={poste.tipoTerreno}
                onChange={(e) => onCambiar({ tipo_terreno: e.target.value as DatosPoste["tipo_terreno"] })}
              >
                {opciones.terrenos.map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <h6 style={{ margin: "0 0 8px" }}>Herrajes asignados</h6>
          {herrajes.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              Este poste todavía no tiene componentes.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {herrajes.map(([codigo, h]) => (
                <div
                  key={codigo}
                  className={fila}
                  style={{
                    border: `1px ${h.manual ? "dashed var(--color-accent)" : "solid var(--color-divider)"}`,
                    borderRadius: "var(--radius-md)",
                    background: h.manual ? "color-mix(in srgb, var(--color-accent) 7%, transparent)" : undefined,
                  }}
                >
                  <span>{h.nombre}</span>
                  <span className="num text-muted ml-auto">×{h.cantidad}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 0 }} onClick={onConfigurar}>
            <Pencil size={14} strokeWidth={1.8} />
            Configurar poste
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            style={{ marginTop: 0 }}
            disabled={ocupado}
            onClick={onAplicarATramo}
          >
            Aplicar a todo el tramo
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: 0, color: "var(--color-neutral-700)" }}
            disabled={ocupado}
            onClick={onEliminar}
          >
            <Trash2 size={14} strokeWidth={1.8} />
            Eliminar poste
          </button>
        </div>
      </div>
    </>
  );
}

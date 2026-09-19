// frontend-web/src/components/ModalPoste.tsx
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import {
  actualizarComponente,
  borrarComponente,
  crearComponente,
  resolverLayout,
} from "../api/proyectos";
import type { ComponenteVisual, EstructuraCFE, PosteComponente, PrefijoEstructura } from "../api/tipos";
import type { PosteConIcono } from "../hooks/useTramoConPostes";
import { codigoPoste } from "../lib/formato";
import PosteDesglose from "./PosteDesglose";
import PosteDiagrama from "./PosteDiagrama";
import SelectorEstructura from "./SelectorEstructura";

interface Props {
  proyectoNombre: string;
  poste: PosteConIcono;
  /** Posición del poste dentro del tramo (base 1) y total de postes, para "5 / 34". */
  posicion: number;
  total: number;
  /** Códigos de los postes vecinos ("P-04 – P-06"), para el kicker. */
  vecinos: string;
  estructuras: EstructuraCFE[];
  prefijos: PrefijoEstructura[];
  catalogo: ComponenteVisual[];
  onCambiarEstructura: (id: number) => void;
  onAnterior: (() => void) | null;
  onSiguiente: (() => void) | null;
  onCerrar: () => void;
  /** Se llama tras cambiar componentes para que el padre recargue los postes. */
  onCambio: () => void;
  onError: (mensaje: string) => void;
}

/** Estructuras que mejor encajan como alternativa: las que admiten la deflexión real del poste y su misma familia. */
function alternativas(poste: PosteConIcono, estructuras: EstructuraCFE[]): EstructuraCFE[] {
  const actual = poste.estructura;
  const angulo = poste.anguloDeflexion;
  const puntaje = (e: EstructuraCFE) => {
    const mt = e.estructura_mt!;
    let p = 0;
    if (angulo !== null) {
      const sinRango = mt.angulo_min === null && mt.angulo_max === null;
      const dentro = (mt.angulo_min === null || angulo >= mt.angulo_min) && (mt.angulo_max === null || angulo <= mt.angulo_max);
      p += sinRango ? 1 : dentro ? 3 : 0;
    }
    if (mt.prefijo_codigo === actual.estructura_mt?.prefijo_codigo) p += 1;
    if (e.codigo.slice(-2) === actual.codigo.slice(-2)) p += 1; // mismas fases y tipo de neutro
    return p;
  };
  return estructuras
    .filter((e) => e.estructura_mt && e.id !== actual.id)
    .sort((a, b) => puntaje(b) - puntaje(a) || a.codigo.localeCompare(b.codigo))
    .slice(0, 3);
}

function Icono({ codigo, manual }: { codigo: string; manual: boolean }) {
  return (
    <span
      className="grid h-[26px] w-[26px] place-items-center"
      style={{
        border: `1px ${manual ? "dashed var(--color-accent)" : "solid var(--color-divider)"}`,
        borderRadius: "var(--radius-sm)",
        background: "var(--color-neutral-100)",
      }}
    >
      <svg width="18" height="18" aria-hidden="true">
        <use href={`#${codigo}`} width="18" height="18" />
      </svg>
    </span>
  );
}

function InputPosicion({ valor, etiqueta, disabled, onCambiar }: { valor: number; etiqueta: string; disabled: boolean; onCambiar: (v: number) => void }) {
  return (
    <input
      // La clave con el valor remonta el campo cuando llega el dato del servidor tras arrastrar en el diagrama.
      key={valor}
      type="number"
      step="0.5"
      aria-label={etiqueta}
      defaultValue={valor}
      disabled={disabled}
      className="input num"
      style={{ width: 66, minHeight: 28, padding: "3px 6px", textAlign: "right", fontSize: 12.5 }}
      onBlur={(e) => {
        const nuevo = Number(e.target.value);
        if (e.target.value !== "" && nuevo !== valor) onCambiar(nuevo);
      }}
    />
  );
}

export default function ModalPoste({
  proyectoNombre,
  poste,
  posicion,
  total,
  vecinos,
  estructuras,
  prefijos,
  catalogo,
  onCambiarEstructura,
  onAnterior,
  onSiguiente,
  onCerrar,
  onCambio,
  onError,
}: Props) {
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [nuevoId, setNuevoId] = useState<number | "">("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setOcupado(true);
    try {
      await accion();
      onCambio();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const manuales = poste.componentes.filter((c) => c.modo === "manual");
  const ordenados = [...poste.componentes].sort((a, b) => a.y - b.y || a.x - b.x);
  const sugeridas = alternativas(poste, estructuras);
  const mt = poste.estructura.estructura_mt;
  const angulo = poste.anguloDeflexion;
  const enRango =
    angulo !== null &&
    mt !== null &&
    (mt.angulo_min === null || angulo >= mt.angulo_min) &&
    (mt.angulo_max === null || angulo <= mt.angulo_max);

  const mover = (c: PosteComponente, cambios: { x?: number; y?: number }) =>
    ejecutar(() => actualizarComponente(poste.id, c.id, cambios));

  const restablecer = () => {
    const aviso = manuales.length
      ? `Se descartarán ${manuales.length} ajuste(s) manual(es) y los componentes volverán a lo que dicta la norma. ¿Continuar?`
      : "Se recalcularán los componentes automáticos según la norma. ¿Continuar?";
    if (!window.confirm(aviso)) return;
    void ejecutar(async () => {
      await Promise.all(manuales.map((c) => borrarComponente(poste.id, c.id)));
      await resolverLayout(poste.id);
    });
  };

  const agregar = () => {
    if (nuevoId === "") return;
    // Sobre el eje del poste, a la altura de las piezas existentes (o cerca de la punta si no hay ninguna).
    const y = poste.componentes.length ? Math.max(...poste.componentes.map((c) => c.y)) : 100;
    void ejecutar(async () => {
      await crearComponente(poste.id, nuevoId, 0, y);
      setAgregando(false);
      setNuevoId("");
    });
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
        aria-label={`Configuración del poste ${codigoPoste(poste.orden)}`}
        className="flex w-[1160px] max-w-full flex-col overflow-hidden"
        style={{
          maxHeight: "calc(100vh - 68px)",
          background: "var(--color-bg)",
          border: "1px solid var(--color-divider)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-divider)", background: "var(--color-neutral-100)" }}
        >
          <div className="min-w-0">
            <div className="card-kicker truncate">
              {proyectoNombre} · {vecinos}
            </div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, lineHeight: 1.1 }}>
              Configuración del poste {codigoPoste(poste.orden)}
            </div>
          </div>
          <span className={`tag ml-3.5 ${angulo !== null && !enRango && mt ? "tag-outline" : "tag-accent"}`}>
            {mt ? `${mt.codigo} · ` : ""}
            {angulo === null ? (poste.esAncla ? "ancla" : "paso") : enRango ? `deflexión ${angulo.toFixed(1)}° en rango` : `deflexión ${angulo.toFixed(1)}° fuera de rango`}
          </span>
          <div className="ml-auto flex items-center gap-2.5">
            <button type="button" className="btn btn-secondary btn-icon" aria-label="Poste anterior" disabled={!onAnterior} onClick={() => onAnterior?.()}>
              <ChevronLeft size={15} strokeWidth={1.8} />
            </button>
            <span className="num text-muted" style={{ fontSize: 12 }}>
              {posicion} / {total}
            </span>
            <button type="button" className="btn btn-secondary btn-icon" aria-label="Poste siguiente" disabled={!onSiguiente} onClick={() => onSiguiente?.()}>
              <ChevronRight size={15} strokeWidth={1.8} />
            </button>
            <span className="h-[22px] w-px" style={{ background: "var(--color-divider)" }} />
            <button type="button" className="btn btn-ghost" aria-label="Cerrar" onClick={onCerrar}>
              <X size={17} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Diagrama */}
          <div
            className="flex w-[430px] flex-none flex-col"
            style={{ borderRight: "1px solid var(--color-divider)", background: "var(--color-surface)" }}
          >
            <div className="flex items-center gap-2.5 px-[18px] pt-3.5">
              <h6 style={{ margin: 0 }}>Diagrama de estructura</h6>
              <span className="text-muted num ml-auto" style={{ fontSize: 11 }}>
                vista lateral · {poste.alturaM} m
              </span>
            </div>
            <div className="min-h-[420px] flex-1 px-4 py-2">
              <PosteDiagrama
                componentes={poste.componentes}
                empotramientoCm={poste.empotramientoCm}
                alturaM={poste.alturaM}
                seleccionadoId={seleccionadoId}
                onSeleccionar={setSeleccionadoId}
                onMover={(id, x, y) => {
                  const c = poste.componentes.find((k) => k.id === id);
                  if (c) void mover(c, { x, y });
                }}
              />
            </div>
            <div className="text-muted flex gap-4 px-[18px] pb-4 pt-2.5" style={{ fontSize: 11.5 }}>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4" style={{ border: "1px solid var(--color-neutral-700)", borderRadius: 2 }} />
                Colocado automáticamente
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-4"
                  style={{
                    border: "1px dashed var(--color-accent)",
                    borderRadius: 2,
                    background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                  }}
                />
                Editado manualmente
              </span>
            </div>
          </div>

          {/* Controles */}
          <div className="flex min-w-0 flex-1 flex-col overflow-auto">
            <div className="px-6 pt-[18px]">
              <div className="mb-2.5 flex items-center gap-3">
                <h6 style={{ margin: 0 }}>Tipo de estructura</h6>
                <div className="ml-auto w-64">
                  <SelectorEstructura
                    aria-label="Otra estructura"
                    estructuras={estructuras}
                    prefijos={prefijos}
                    valor={null}
                    marcador="Otra estructura…"
                    onCambiar={onCambiarEstructura}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                <div className="card" style={{ gap: 6, padding: 11, boxShadow: "inset 0 0 0 1px var(--color-accent)" }}>
                  <div className="card-kicker">Seleccionada</div>
                  <div className="card-title">{poste.estructura.codigo}</div>
                  <div className="card-body" style={{ fontSize: 12 }}>
                    {poste.estructura.nombre}
                  </div>
                </div>
                {sugeridas.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="card text-left"
                    style={{ gap: 6, padding: 11, cursor: "pointer", font: "inherit", color: "inherit" }}
                    onClick={() => onCambiarEstructura(e.id)}
                  >
                    <div className="card-kicker" style={{ color: "var(--color-neutral-600)" }}>
                      Alterna
                    </div>
                    <div className="card-title">{e.codigo}</div>
                    <div className="card-body" style={{ fontSize: 12 }}>
                      {e.nombre}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 pt-[18px]">
              <h6 style={{ margin: 0 }}>Componentes de herraje</h6>
              <span className="text-muted" style={{ fontSize: 12 }}>
                {poste.componentes.length} {poste.componentes.length === 1 ? 'pieza' : 'piezas'} · {manuales.length}{' '}
                {manuales.length === 1 ? 'editada' : 'editadas'} manualmente
              </span>
              <button type="button" className="btn btn-ghost ml-auto" disabled={ocupado} onClick={restablecer}>
                Restablecer a la norma
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setAgregando((v) => !v)}>
                Agregar componente
              </button>
            </div>

            {agregando && (
              <div className="flex gap-2 px-6 pt-2.5">
                <select
                  className="input"
                  aria-label="Componente a agregar"
                  value={nuevoId}
                  onChange={(e) => setNuevoId(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">Elige un componente…</option>
                  {catalogo.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-primary" disabled={ocupado || nuevoId === ""} onClick={agregar}>
                  Agregar
                </button>
              </div>
            )}

            <div className="px-6 pt-2">
              {ordenados.length === 0 ? (
                <p className="text-muted" style={{ padding: "12px 0" }}>
                  Este poste todavía no tiene componentes.
                </p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }} />
                      <th>Componente</th>
                      <th>Código</th>
                      <th>Posición (x, y)</th>
                      <th>Origen</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {ordenados.map((c) => {
                      const manual = c.modo === "manual";
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSeleccionadoId(c.id)}
                          style={{
                            cursor: "pointer",
                            background:
                              c.id === seleccionadoId
                                ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                                : manual
                                  ? "color-mix(in srgb, var(--color-accent) 6%, transparent)"
                                  : undefined,
                          }}
                        >
                          <td>
                            <Icono codigo={c.componente_visual_codigo} manual={manual} />
                          </td>
                          <td>
                            <span style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>{c.componente_visual.nombre}</span>
                            <div className="text-muted" style={{ fontSize: 11 }}>
                              {manual ? "Agregado o ajustado manualmente" : c.regla_descripcion || "Según la norma"}
                            </div>
                          </td>
                          <td className="num">{c.material_codigo || "—"}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <InputPosicion valor={c.x} etiqueta={`${c.componente_visual.nombre}, x`} disabled={ocupado} onCambiar={(x) => void mover(c, { x })} />
                              <InputPosicion valor={c.y} etiqueta={`${c.componente_visual.nombre}, y`} disabled={ocupado} onCambiar={(y) => void mover(c, { y })} />
                            </div>
                          </td>
                          <td>
                            <span className={`tag ${manual ? "tag-accent" : "tag-neutral"}`}>{manual ? "Manual" : "Automático"}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              aria-label={`Quitar ${c.componente_visual.nombre}`}
                              disabled={ocupado}
                              onClick={(e) => {
                                e.stopPropagation();
                                void ejecutar(() => borrarComponente(poste.id, c.id));
                              }}
                            >
                              <Trash2 size={15} strokeWidth={1.8} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 pb-4 pt-[18px]">
              <h6 style={{ margin: "0 0 8px" }}>Materiales según la norma</h6>
              <PosteDesglose poste={poste} />
            </div>

            <div
              className="sticky bottom-0 mt-auto flex items-center gap-3 px-6 py-3.5"
              style={{ borderTop: "1px solid var(--color-divider)", background: "var(--color-neutral-100)" }}
            >
              <span className="text-muted" style={{ fontSize: 12.5 }}>
                Los cambios se guardan al momento. Los ajustes manuales se conservan al recalcular la trayectoria.
              </span>
              <button type="button" className="btn btn-primary ml-auto" onClick={onCerrar}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

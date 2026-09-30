// frontend-web/src/components/catalogo/ModalRevisionEstructura.tsx
import { useEffect, useState } from 'react'
import { BadgeCheck, Plus, Trash2, X } from 'lucide-react'
import { revisarEstructura } from '../../api/proyectos'
import type { EstructuraNormativa, LineaRevision, MaterialCatalogo } from '../../api/tipos'
import { ETIQUETA_CATEGORIA } from '../../lib/formato'

interface Props {
  estructura: EstructuraNormativa
  /** Catálogo completo de materiales, para agregar nuevas líneas. */
  materiales: MaterialCatalogo[]
  /** Se llama con el resultado ya guardado para que el catálogo se recargue. */
  onGuardado: () => void
  onCerrar: () => void
}

/** Línea editable: los campos numéricos se guardan como texto para poder teclearlos a medias. */
interface Fila {
  clave: number
  id?: number
  material: number | ''
  descripcion: string
  cantidad: string
  condicion: string
  cantidad_estimada: boolean
}

let siguienteClave = 0

const numeroOVacio = (texto: string) => (texto.trim() === '' ? null : Number(texto))

export default function ModalRevisionEstructura({ estructura, materiales, onGuardado, onCerrar }: Props) {
  const [nombre, setNombre] = useState(estructura.nombre)
  const [categoria, setCategoria] = useState(estructura.categoria)
  const [anguloMin, setAnguloMin] = useState(estructura.angulo_min?.toString() ?? '')
  const [anguloMax, setAnguloMax] = useState(estructura.angulo_max?.toString() ?? '')
  const [esTerminal, setEsTerminal] = useState(estructura.es_terminal)
  const [descripcion, setDescripcion] = useState(estructura.descripcion)
  const [filas, setFilas] = useState<Fila[]>(() =>
    estructura.materiales.map((m) => ({
      clave: ++siguienteClave,
      id: m.id,
      material: m.material_id ?? '',
      descripcion: m.descripcion,
      cantidad: String(m.cantidad),
      condicion: m.condicion,
      cantidad_estimada: m.cantidad_estimada,
    })),
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && !guardando && onCerrar()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar, guardando])

  const cambiarFila = (clave: number, cambios: Partial<Fila>) =>
    setFilas((actual) => actual.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)))

  const agregar = () =>
    setFilas((actual) => [
      ...actual,
      { clave: ++siguienteClave, material: '', descripcion: '', cantidad: '1', condicion: '', cantidad_estimada: false },
    ])

  const filaInvalida = (f: Fila) => f.material === '' || f.cantidad.trim() === '' || !(Number(f.cantidad) >= 0)
  const hayInvalidas = filas.some(filaInvalida)
  const angulosInvalidos =
    (anguloMin.trim() !== '' && Number.isNaN(Number(anguloMin))) || (anguloMax.trim() !== '' && Number.isNaN(Number(anguloMax)))

  const guardar = async (validar: boolean) => {
    setGuardando(true)
    setError(null)
    try {
      await revisarEstructura(estructura.id, {
        nombre: nombre.trim(),
        categoria,
        angulo_min: numeroOVacio(anguloMin),
        angulo_max: numeroOVacio(anguloMax),
        es_terminal: esTerminal,
        descripcion,
        materiales: filas.map(
          (f): LineaRevision => ({
            id: f.id,
            material: f.material as number,
            descripcion: f.descripcion.trim(),
            cantidad: Number(f.cantidad),
            condicion: f.condicion.trim(),
            cantidad_estimada: f.cantidad_estimada,
          }),
        ),
        validar,
      })
      onGuardado()
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  const bloqueado = guardando || hayInvalidas || angulosInvalidos

  return (
    <div
      className="fixed inset-0 z-[2000] grid place-items-center p-[34px]"
      style={{ background: 'color-mix(in srgb, #2d2b2b 55%, transparent)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(e) => e.target === e.currentTarget && !guardando && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Revisar estructura ${estructura.codigo}`}
        className="flex w-[880px] max-w-full flex-col overflow-hidden"
        style={{
          maxHeight: 'calc(100vh - 68px)',
          background: 'var(--color-bg)',
          border: '1px solid var(--color-divider)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          className="flex items-start gap-3 px-6 py-4"
          style={{ borderBottom: '1px solid var(--color-divider)', background: 'var(--color-neutral-100)' }}
        >
          <div>
            <div className="card-kicker">
              Revisión técnica · {estructura.fuente_codigo}
              {estructura.fuente_pagina !== null && ` · pág. ${estructura.fuente_pagina}`}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, lineHeight: 1.1 }}>{estructura.codigo}</div>
          </div>
          <span className={`tag ${estructura.verificado ? 'tag-outline' : 'tag-neutral'}`} style={{ marginTop: 4 }}>
            {estructura.verificado ? 'Validada' : 'Por validar'}
          </span>
          <button type="button" className="btn btn-ghost ml-auto" aria-label="Cerrar" disabled={guardando} onClick={onCerrar}>
            <X size={17} strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-auto px-6 py-5">
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="rev-nombre">Nombre</label>
              <input id="rev-nombre" className="input" value={nombre} disabled={guardando} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rev-categoria">Categoría</label>
              <select id="rev-categoria" className="input" value={categoria} disabled={guardando} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Sin categoría</option>
                {Object.entries(ETIQUETA_CATEGORIA).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Deflexión admitida (°)</label>
              <div className="flex items-center gap-2">
                <input
                  className="input num"
                  inputMode="decimal"
                  placeholder="Mín."
                  aria-label="Ángulo mínimo"
                  value={anguloMin}
                  disabled={guardando}
                  onChange={(e) => setAnguloMin(e.target.value)}
                />
                <span className="text-muted">a</span>
                <input
                  className="input num"
                  inputMode="decimal"
                  placeholder="Máx."
                  aria-label="Ángulo máximo"
                  value={anguloMax}
                  disabled={guardando}
                  onChange={(e) => setAnguloMax(e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2" style={{ fontSize: 13.5 }}>
              <input type="checkbox" checked={esTerminal} disabled={guardando} onChange={(e) => setEsTerminal(e.target.checked)} />
              Estructura terminal (remate)
            </label>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="rev-descripcion">Descripción</label>
              <textarea
                id="rev-descripcion"
                className="input"
                rows={2}
                value={descripcion}
                disabled={guardando}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center" style={{ marginBottom: 8 }}>
              <h6 style={{ margin: 0 }}>Materiales ({filas.length})</h6>
              <button type="button" className="btn btn-secondary ml-auto" disabled={guardando} onClick={agregar}>
                <Plus size={14} strokeWidth={2} />
                Agregar material
              </button>
            </div>
            {filas.length === 0 ? (
              <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                Sin materiales: agrégalos para poder validar la estructura.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filas.map((f) => (
                  <div
                    key={f.clave}
                    className="grid items-center gap-2"
                    style={{ gridTemplateColumns: 'minmax(0, 2fr) 84px minmax(0, 1.4fr) auto 32px' }}
                  >
                    <select
                      className="input"
                      aria-label="Material"
                      value={f.material}
                      disabled={guardando}
                      onChange={(e) => cambiarFila(f.clave, { material: e.target.value === '' ? '' : Number(e.target.value) })}
                    >
                      <option value="">Elige un material…</option>
                      {materiales.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre} ({m.unidad})
                        </option>
                      ))}
                    </select>
                    <input
                      className="input num"
                      inputMode="decimal"
                      aria-label="Cantidad"
                      placeholder="Cant."
                      value={f.cantidad}
                      disabled={guardando}
                      style={{ textAlign: 'right' }}
                      onChange={(e) => cambiarFila(f.clave, { cantidad: e.target.value })}
                    />
                    <input
                      className="input"
                      aria-label="Condición"
                      placeholder="Condición (opcional)"
                      value={f.condicion}
                      disabled={guardando}
                      onChange={(e) => cambiarFila(f.clave, { condicion: e.target.value })}
                    />
                    <label className="flex items-center gap-1.5" style={{ fontSize: 12.5 }} title="Cantidad estimada, por validar contra catálogo real">
                      <input
                        type="checkbox"
                        checked={f.cantidad_estimada}
                        disabled={guardando}
                        onChange={(e) => cambiarFila(f.clave, { cantidad_estimada: e.target.checked })}
                      />
                      Estimada
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      style={{ width: 32, height: 32 }}
                      aria-label="Quitar material"
                      disabled={guardando}
                      onClick={() => setFilas((actual) => actual.filter((x) => x.clave !== f.clave))}
                    >
                      <Trash2 size={15} strokeWidth={1.8} />
                    </button>
                    <input
                      className="input"
                      aria-label="Descripción del material"
                      placeholder="Descripción en esta estructura (opcional)"
                      value={f.descripcion}
                      disabled={guardando}
                      style={{ gridColumn: '1 / -1', minHeight: 28, padding: '3px 8px', fontSize: 12.5 }}
                      onChange={(e) => cambiarFila(f.clave, { descripcion: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--color-accent-700)' }}>
              {error}
            </p>
          )}
        </div>

        <div
          className="flex items-center gap-3 px-6 py-3.5"
          style={{ borderTop: '1px solid var(--color-divider)', background: 'var(--color-neutral-100)' }}
        >
          <span className="text-muted" style={{ fontSize: 12.5 }}>
            Guardar sin validar deja la estructura por validar. Validar confirma datos y materiales contra el documento.
          </span>
          <div className="ml-auto flex gap-2.5">
            <button type="button" className="btn btn-secondary" disabled={guardando} onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className="btn btn-secondary" disabled={bloqueado} onClick={() => guardar(false)}>
              Guardar
            </button>
            <button type="button" className="btn btn-primary" disabled={bloqueado || filas.length === 0} onClick={() => guardar(true)}>
              <BadgeCheck size={15} strokeWidth={2} />
              {guardando ? 'Guardando…' : 'Guardar y validar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

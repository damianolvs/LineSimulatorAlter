// frontend-web/src/components/catalogo/TabEstructuras.tsx
import { Fragment, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { EstructuraNormativa, PrefijoEstructura } from '../../api/tipos'
import { ETIQUETA_CATEGORIA, formatearCantidad, formatearRangoAngulo } from '../../lib/formato'

interface Props {
  estructuras: EstructuraNormativa[]
  prefijos: PrefijoEstructura[]
  /** Código de la estructura seleccionada (viene de la URL) y cómo cambiarla. */
  seleccion: string | null
  onSeleccionar: (codigo: string) => void
}

function Detalle({ estructura, familia }: { estructura: EstructuraNormativa; familia: string }) {
  const sinVerificar = estructura.materiales.filter((m) => !m.verificado).length
  return (
    <div
      className="flex flex-col gap-4 p-5"
      style={{ border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', background: 'var(--color-neutral-100)' }}
    >
      <div>
        <div className="card-kicker">
          Familia {estructura.prefijo_codigo}
          {familia && ` · ${familia}`}
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, lineHeight: 1.1 }}>{estructura.codigo}</div>
        <div className="text-muted" style={{ fontSize: 13.5 }}>
          {estructura.nombre}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {estructura.categoria && (
          <span className="tag tag-accent">{ETIQUETA_CATEGORIA[estructura.categoria] ?? estructura.categoria}</span>
        )}
        {estructura.es_terminal && <span className="tag tag-neutral">Terminal</span>}
        <span className={`tag ${estructura.verificado ? 'tag-outline' : 'tag-neutral'}`}>
          {estructura.verificado ? 'Verificada' : 'Por verificar'}
        </span>
      </div>

      {estructura.descripcion && <p style={{ margin: 0, fontSize: 13.5 }}>{estructura.descripcion}</p>}

      <table className="table" style={{ fontSize: 13 }}>
        <tbody>
          <tr>
            <td style={{ paddingLeft: 0 }}>Deflexión admitida</td>
            <td className="num" style={{ textAlign: 'right', paddingRight: 0 }}>
              {formatearRangoAngulo(estructura.angulo_min, estructura.angulo_max)}
            </td>
          </tr>
          <tr>
            <td style={{ paddingLeft: 0, borderBottom: 0 }}>Fuente normativa</td>
            <td className="num" style={{ textAlign: 'right', paddingRight: 0, borderBottom: 0 }}>
              {estructura.fuente_codigo}
              {estructura.fuente_pagina !== null && ` · pág. ${estructura.fuente_pagina}`}
            </td>
          </tr>
        </tbody>
      </table>

      <div>
        <h6 style={{ margin: '0 0 8px' }}>Materiales por estructura</h6>
        {estructura.materiales.length === 0 ? (
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            Esta estructura aún no tiene sus materiales digitalizados: al colocarla en un poste no genera componentes ni
            entra en la lista de materiales.
          </p>
        ) : (
          <>
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 0 }}>Material</th>
                  <th style={{ textAlign: 'right', paddingRight: 0 }}>Cant.</th>
                </tr>
              </thead>
              <tbody>
                {estructura.materiales.map((m, i) => (
                  <tr key={`${m.material_codigo}-${i}`}>
                    <td style={{ paddingLeft: 0 }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}>{m.descripcion || m.material_nombre}</span>
                      {!m.verificado && (
                        <span className="text-muted" title="Regla pendiente de verificar contra el documento normativo">
                          {' '}
                          *
                        </span>
                      )}
                      <div className="text-muted num" style={{ fontSize: 11 }}>
                        {[m.material_codigo, m.condicion].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="num" style={{ textAlign: 'right', paddingRight: 0 }}>
                      {formatearCantidad(m.cantidad)}
                      {m.cantidad_estimada && (
                        <span className="text-muted" title="Cantidad estimada, por validar contra catálogo real">
                          {' '}
                          ~
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sinVerificar > 0 && (
              <p className="text-muted" style={{ margin: '8px 0 0', fontSize: 11.5 }}>
                * {sinVerificar} de {estructura.materiales.length} reglas aún sin confirmar por un técnico contra el PDF. ~
                Cantidad estimada.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function TabEstructuras({ estructuras, prefijos, seleccion, onSeleccionar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [familia, setFamilia] = useState('')
  const [categoria, setCategoria] = useState('')

  const nombrePrefijo = useMemo(() => new Map(prefijos.map((p) => [p.codigo, p.nombre])), [prefijos])
  const categorias = useMemo(() => [...new Set(estructuras.map((e) => e.categoria).filter(Boolean))].sort(), [estructuras])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return estructuras.filter(
      (e) =>
        (!familia || e.prefijo_codigo === familia) &&
        (!categoria || e.categoria === categoria) &&
        (!texto || `${e.codigo} ${e.nombre}`.toLowerCase().includes(texto)),
    )
  }, [estructuras, busqueda, familia, categoria])

  const grupos = useMemo(() => {
    const porFamilia = new Map<string, EstructuraNormativa[]>()
    for (const e of visibles) porFamilia.set(e.prefijo_codigo, [...(porFamilia.get(e.prefijo_codigo) ?? []), e])
    return [...porFamilia.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [visibles])

  // Sin selección válida en la URL (o si el filtro la oculta) se muestra la primera de la lista.
  const actual = visibles.find((e) => e.codigo === seleccion) ?? visibles[0]
  const conMateriales = estructuras.filter((e) => e.materiales.length > 0).length
  const verificadas = estructuras.filter((e) => e.verificado).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Search size={14} strokeWidth={2} className="absolute left-[9px] top-[11px]" style={{ color: 'var(--color-neutral-600)' }} />
          <input
            className="input"
            style={{ width: 250, paddingLeft: 28 }}
            placeholder="Buscar por código o nombre"
            aria-label="Buscar estructura"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select className="input" style={{ width: 'auto' }} aria-label="Familia" value={familia} onChange={(e) => setFamilia(e.target.value)}>
          <option value="">Todas las familias</option>
          {prefijos.map((p) => (
            <option key={p.id} value={p.codigo}>
              {p.codigo} — {p.nombre}
            </option>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} aria-label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {ETIQUETA_CATEGORIA[c] ?? c}
            </option>
          ))}
        </select>
        <span className="text-muted ml-auto" style={{ fontSize: 12 }}>
          {estructuras.length} estructuras · {conMateriales} con materiales · {verificadas} verificadas
        </span>
      </div>

      <div className="grid items-start gap-5" style={{ gridTemplateColumns: 'minmax(0, 1fr) 420px' }}>
        <div
          style={{ border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', background: 'var(--color-neutral-100)', overflow: 'hidden' }}
        >
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 18, width: 96 }}>Código</th>
                <th>Estructura</th>
                <th>Categoría</th>
                <th style={{ textAlign: 'right' }}>Deflexión</th>
                <th style={{ textAlign: 'right', paddingRight: 18 }}>Mat.</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(([prefijo, lista]) => (
                <Fragment key={prefijo}>
                  <tr>
                    <td colSpan={5} style={{ paddingLeft: 18, background: 'var(--color-surface)' }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, letterSpacing: '.09em', textTransform: 'uppercase' }}>
                        {prefijo} · {nombrePrefijo.get(prefijo) ?? 'Familia'}
                      </span>
                      <span className="text-muted num" style={{ fontSize: 11, marginLeft: 10 }}>
                        {lista.length} estructuras
                      </span>
                    </td>
                  </tr>
                  {lista.map((e) => {
                    const activa = e.codigo === actual?.codigo
                    return (
                      <tr
                        key={e.id}
                        tabIndex={0}
                        aria-selected={activa}
                        className="cursor-pointer"
                        onClick={() => onSeleccionar(e.codigo)}
                        onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onSeleccionar(e.codigo))}
                        style={{ background: activa ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : undefined }}
                      >
                        <td style={{ paddingLeft: 18, fontFamily: 'var(--font-heading)', fontSize: 16 }}>{e.codigo}</td>
                        <td>{e.nombre}</td>
                        <td className="text-muted" style={{ fontSize: 12.5 }}>
                          {ETIQUETA_CATEGORIA[e.categoria] ?? '—'}
                        </td>
                        <td className="num text-muted" style={{ textAlign: 'right' }}>
                          {formatearRangoAngulo(e.angulo_min, e.angulo_max)}
                        </td>
                        <td className="num" style={{ textAlign: 'right', paddingRight: 18 }}>
                          {e.materiales.length || <span className="text-muted">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted" style={{ padding: 32, textAlign: 'center', borderBottom: 0 }}>
                    Ninguna estructura coincide con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sticky top-4">
          {actual ? (
            <Detalle estructura={actual} familia={nombrePrefijo.get(actual.prefijo_codigo) ?? ''} />
          ) : (
            <p className="text-muted">Elige una estructura para ver su detalle.</p>
          )}
        </div>
      </div>
    </div>
  )
}

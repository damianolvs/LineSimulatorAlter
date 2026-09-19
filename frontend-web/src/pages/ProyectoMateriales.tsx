// src/pages/ProyectoMateriales.tsx — lista de materiales (mockup 1d)
import { Fragment, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, Printer } from 'lucide-react'
import { obtenerMateriales, obtenerProyecto } from '../api/proyectos'
import type { ListaMateriales } from '../api/tipos'
import BarraProyecto from '../components/BarraProyecto'
import { useCargar } from '../hooks/useCargar'
import { codigoPoste, formatearCantidad, formatearKm, formatearNumero } from '../lib/formato'

type Agrupacion = 'material' | 'poste'

const unidad = (u: string) => u.toLowerCase()
const descripcionPoste = (altura: number, resistencia: number) => `Poste de concreto ${altura} m · ${resistencia} kg`

function Indicador({ titulo, valor, detalle, destacado }: { titulo: string; valor: string; detalle: string; destacado?: boolean }) {
  return (
    <div className="card" style={destacado ? { boxShadow: 'inset 0 0 0 1px var(--color-accent)' } : undefined}>
      <div className="card-kicker">{titulo}</div>
      <div className="num" style={{ fontFamily: 'var(--font-heading)', fontSize: 32, lineHeight: 1 }}>
        {valor}
      </div>
      <div className="card-meta">{detalle}</div>
    </div>
  )
}

function Seccion({ titulo, detalle, columnas }: { titulo: string; detalle?: string; columnas: number }) {
  return (
    <tr>
      <td colSpan={columnas} style={{ paddingLeft: 18, background: 'var(--color-surface)' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, letterSpacing: '.09em', textTransform: 'uppercase' }}>{titulo}</span>
        {detalle && (
          <span className="text-muted num" style={{ fontSize: 11, marginLeft: 10 }}>
            {detalle}
          </span>
        )}
      </td>
    </tr>
  )
}

/** CSV con BOM UTF-8 para que Excel respete los acentos. */
function descargarCsv(nombreProyecto: string, lista: ListaMateriales) {
  const filas: (string | number)[][] = [['Sección', 'Partida', 'Código', 'Unidad', 'Cantidad']]
  for (const p of lista.postes) {
    filas.push(['Postes', descripcionPoste(p.altura_m, p.resistencia_kg), '', 'pza', p.cantidad])
  }
  for (const m of lista.materiales) {
    filas.push(['Herrajes y materiales', m.nombre + (m.verificado ? '' : ' *'), m.codigo, unidad(m.unidad), m.cantidad])
  }
  const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  enlace.download = `materiales-${nombreProyecto.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}

export default function ProyectoMateriales() {
  const { id } = useParams()
  const { datos, cargando, error } = useCargar(() => Promise.all([obtenerProyecto(id!), obtenerMateriales(id!)]), [id])
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('material')

  if (error) {
    return (
      <div className="p-10">
        No se pudo generar la lista: {error}. <Link to={`/proyectos/${id}`}>Volver al editor</Link>
      </div>
    )
  }
  if (!datos) return <p className="p-10 text-muted">{cargando ? 'Generando lista de materiales…' : ''}</p>

  const [proyecto, lista] = datos
  const { resumen } = lista
  const desglosePostes = lista.postes.map((p) => `${p.cantidad} × ${p.altura_m} m/${p.resistencia_kg} kg`).join(' · ')
  const hoy = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()).replace(/\./g, '')

  return (
    <div className="imprimir-libre flex h-screen flex-col" style={{ background: 'var(--color-bg)' }}>
      <BarraProyecto
        volverA={`/proyectos/${proyecto.id}`}
        etiquetaVolver="Editor de mapa"
        titulo={proyecto.nombre}
        acciones={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => descargarCsv(proyecto.nombre, lista)}>
              <Download size={14} strokeWidth={1.8} />
              Exportar CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={14} strokeWidth={1.8} />
              Imprimir / PDF
            </button>
          </>
        }
      >
        <span className="text-muted num" style={{ fontSize: 12 }}>
          Lista de materiales · generada {hoy}
        </span>
      </BarraProyecto>

      <div className="imprimir-libre flex min-h-0 flex-1 flex-col gap-[18px] px-10 pt-6">
        <div className="flex items-end gap-5">
          <div>
            <h2 style={{ margin: '0 0 2px' }}>Lista de materiales</h2>
            <div className="text-muted" style={{ fontSize: 13 }}>
              Generada del trazo vigente · cantidades según las reglas normativas de cada estructura
            </div>
          </div>
          <div className="seg no-imprimir ml-auto">
            <label className="seg-opt">
              <input type="radio" name="agrupacion" checked={agrupacion === 'material'} onChange={() => setAgrupacion('material')} />
              Por material
            </label>
            <label className="seg-opt">
              <input type="radio" name="agrupacion" checked={agrupacion === 'poste'} onChange={() => setAgrupacion('poste')} />
              Por poste
            </label>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          <Indicador titulo="Postes" valor={String(resumen.num_postes)} detalle={desglosePostes || 'sin postes'} />
          <Indicador
            titulo="Tramos (vanos)"
            valor={String(resumen.num_vanos)}
            detalle={resumen.vano_promedio_m === null ? 'sin vanos' : `promedio ${formatearNumero(resumen.vano_promedio_m, 1)} m`}
          />
          <Indicador titulo="Longitud de línea" valor={formatearKm(resumen.longitud_m)} detalle={`${proyecto.tension_kv} kV`} />
          <Indicador
            titulo="Piezas de herraje"
            valor={formatearNumero(resumen.piezas)}
            detalle={`${resumen.partidas} partidas distintas`}
          />
          <Indicador
            titulo="Partidas por verificar"
            valor={String(resumen.partidas_sin_verificar)}
            detalle="reglas sin confirmar contra el PDF"
            destacado={resumen.partidas_sin_verificar > 0}
          />
        </div>

        <div
          className="imprimir-libre min-h-0 flex-1 overflow-auto"
          style={{ border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', background: 'var(--color-neutral-100)' }}
        >
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 18, width: '44%' }}>Partida</th>
                <th>Código</th>
                <th>Unidad</th>
                <th style={{ textAlign: 'right', paddingRight: 18 }}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {agrupacion === 'material' ? (
                <>
                  <Seccion titulo="Postes" detalle={`${lista.postes.length} partidas`} columnas={4} />
                  {lista.postes.map((p) => (
                    <tr key={`${p.altura_m}-${p.resistencia_kg}`}>
                      <td style={{ paddingLeft: 18 }}>{descripcionPoste(p.altura_m, p.resistencia_kg)}</td>
                      <td className="num text-muted">—</td>
                      <td>pza</td>
                      <td className="num" style={{ textAlign: 'right', paddingRight: 18 }}>
                        {p.cantidad}
                      </td>
                    </tr>
                  ))}
                  <Seccion titulo="Herrajes y materiales" detalle={`${lista.materiales.length} partidas`} columnas={4} />
                  {lista.materiales.map((m) => (
                    <tr key={m.codigo}>
                      <td style={{ paddingLeft: 18 }}>
                        {m.nombre}
                        {!m.verificado && (
                          <span className="text-muted" title="Regla pendiente de verificar contra el documento normativo">
                            {' '}
                            *
                          </span>
                        )}
                      </td>
                      <td className="num">{m.codigo}</td>
                      <td>{unidad(m.unidad)}</td>
                      <td className="num" style={{ textAlign: 'right', paddingRight: 18 }}>
                        {formatearCantidad(m.cantidad)}
                        {m.cantidad_estimada && (
                          <span className="text-muted" title="Cantidad estimada: validar contra el catálogo real">
                            {' '}
                            ~
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </>
              ) : (
                lista.por_poste.map((p) => (
                  <Fragment key={p.poste_id}>
                    <Seccion
                      titulo={`${codigoPoste(p.orden)} · ${p.estructura}`}
                      detalle={`${p.altura_m} m · ${p.resistencia_kg} kg`}
                      columnas={4}
                    />
                    {p.materiales.map((m, i) => (
                      <tr key={`${m.codigo}-${i}`}>
                        <td style={{ paddingLeft: 18 }}>{m.material}</td>
                        <td className="num">{m.codigo}</td>
                        <td>{unidad(m.unidad)}</td>
                        <td className="num" style={{ textAlign: 'right', paddingRight: 18 }}>
                          {formatearCantidad(m.cantidad)}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
              {resumen.num_postes === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted" style={{ padding: 32, textAlign: 'center', borderBottom: 0 }}>
                    Este proyecto aún no tiene postes. <Link to={`/proyectos/${proyecto.id}`}>Traza la línea en el editor</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-5 pb-[18px] pt-3" style={{ borderTop: '1px solid var(--color-divider)' }}>
          <span className="text-muted" style={{ fontSize: 12.5, maxWidth: 560 }}>
            * Partida con reglas aún sin verificar por un técnico. ~ Cantidad estimada, por validar contra catálogo real.
            {lista.sin_reglas.length > 0 && (
              <>
                {' '}
                No incluye {lista.sin_reglas.length} poste(s) con estructura sin reglas normativas:{' '}
                {lista.sin_reglas.map((p) => `${codigoPoste(p.orden)} (${p.estructura})`).join(', ')}.
              </>
            )}
          </span>
          <div className="ml-auto flex items-baseline gap-7">
            <span className="text-muted num" style={{ fontSize: 13 }}>
              Postes{' '}
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 19, color: 'var(--color-text)', marginLeft: 8 }}>
                {resumen.num_postes}
              </span>
            </span>
            <span className="num" style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>
              Piezas de herraje{' '}
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 26, marginLeft: 8 }}>{formatearNumero(resumen.piezas)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// src/pages/ProyectosLista.tsx — dashboard de proyectos (mockup 1a)
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { listarEstructuras, listarProyectos } from '../api/proyectos'
import type { EstadoProyecto } from '../api/tipos'
import { useCargar } from '../hooks/useCargar'
import { CLASE_ESTADO, ETIQUETA_ESTADO, formatearEdicion, formatearKm, formatearNumero } from '../lib/formato'

type Filtro = 'todos' | 'en_diseno' | 'aprobado'

const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'en_diseno', etiqueta: 'En diseño' },
  { id: 'aprobado', etiqueta: 'Aprobados' },
]

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <div className="card">
      <div className="card-kicker">{titulo}</div>
      <div className="num" style={{ fontFamily: 'var(--font-heading)', fontSize: 34, lineHeight: 1 }}>
        {valor}
      </div>
      <div className="card-meta">{detalle}</div>
    </div>
  )
}

export default function ProyectosLista() {
  const navigate = useNavigate()
  const proyectos = useCargar(listarProyectos)
  const estructuras = useCargar(listarEstructuras)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')

  const lista = proyectos.datos
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return (lista ?? []).filter(
      (p) =>
        (filtro === 'todos' || p.estado === filtro) &&
        (!texto || `${p.nombre} ${p.ubicacion} ${p.descripcion}`.toLowerCase().includes(texto)),
    )
  }, [lista, filtro, busqueda])

  const activos = (lista ?? []).filter((p) => p.estado !== 'archivado')
  const totalPostes = (lista ?? []).reduce((suma, p) => suma + p.num_postes, 0)
  const totalMetros = (lista ?? []).reduce((suma, p) => suma + p.longitud_m, 0)
  const conReglas = (estructuras.datos ?? []).filter((e) => e.estructura_mt).length

  return (
    <div className="flex flex-col gap-5 px-10 py-7">
      <div className="flex items-end gap-6">
        <div>
          <h2 style={{ margin: '0 0 2px' }}>Proyectos</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Líneas de distribución en media tensión · 13.8 kV / 34.5 kV
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="relative">
            <Search size={14} strokeWidth={2} className="absolute left-[9px] top-[11px]" style={{ color: 'var(--color-neutral-600)' }} />
            <input
              className="input"
              style={{ width: 230, paddingLeft: 28 }}
              placeholder="Buscar proyecto o ubicación"
              aria-label="Buscar proyecto"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="seg">
            {FILTROS.map((f) => (
              <label key={f.id} className="seg-opt">
                <input type="radio" name="filtro-estado" checked={filtro === f.id} onChange={() => setFiltro(f.id)} />
                {f.etiqueta}
              </label>
            ))}
          </div>
          <Link to="/proyectos/nuevo" className="btn btn-primary no-underline">
            <Plus size={15} strokeWidth={2} />
            Nuevo proyecto
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Indicador
          titulo="Proyectos activos"
          valor={String(activos.length)}
          detalle={`${activos.filter((p) => p.estado === 'en_revision').length} en revisión`}
        />
        <Indicador titulo="Postes planeados" valor={formatearNumero(totalPostes)} detalle="en todos los proyectos" />
        <Indicador titulo="Kilómetros trazados" valor={formatearNumero(totalMetros / 1000, 1)} detalle="km de línea" />
        <Indicador
          titulo="Estructuras CFE"
          valor={String(estructuras.datos?.length ?? 0)}
          detalle={`${conReglas} con reglas normativas`}
        />
      </div>

      {proyectos.error && <p role="alert">No se pudieron cargar los proyectos: {proyectos.error}</p>}
      {proyectos.cargando && !lista && <p className="text-muted">Cargando…</p>}

      {lista && (
        <>
          <div
            style={{
              border: '1px solid var(--color-divider)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-neutral-100)',
              overflow: 'hidden',
            }}
          >
            <table className="table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 18, width: '34%' }}>Proyecto</th>
                  <th>Ubicación</th>
                  <th style={{ textAlign: 'right' }}>Longitud</th>
                  <th style={{ textAlign: 'right' }}>Postes</th>
                  <th>Tensión</th>
                  <th>Última edición</th>
                  <th>Estado</th>
                  <th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {visibles.map((p, i) => {
                  const ultima = i === visibles.length - 1
                  const borde = ultima ? { borderBottom: 0 } : undefined
                  return (
                    <tr key={p.id} className="cursor-pointer" onClick={() => navigate(`/proyectos/${p.id}`)}>
                      <td style={{ paddingLeft: 18, ...borde }}>
                        <Link
                          to={`/proyectos/${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontFamily: 'var(--font-heading)', fontSize: 16, color: 'var(--color-text)', textDecoration: 'none' }}
                        >
                          {p.nombre}
                        </Link>
                        {p.descripcion && (
                          <div className="text-muted truncate" style={{ fontSize: 11, maxWidth: 360 }}>
                            {p.descripcion}
                          </div>
                        )}
                      </td>
                      <td style={borde}>{p.ubicacion || '—'}</td>
                      <td className="num" style={{ textAlign: 'right', ...borde }}>
                        {p.longitud_m > 0 ? formatearKm(p.longitud_m) : '—'}
                      </td>
                      <td className="num" style={{ textAlign: 'right', ...borde }}>
                        {p.num_postes}
                      </td>
                      <td className="num" style={borde}>
                        {p.tension_kv} kV
                      </td>
                      <td className="text-muted" style={borde}>
                        {formatearEdicion(p.actualizado_en)}
                      </td>
                      <td style={borde}>
                        <span className={`tag ${CLASE_ESTADO[p.estado as EstadoProyecto]}`}>{ETIQUETA_ESTADO[p.estado as EstadoProyecto]}</span>
                      </td>
                      <td style={borde}>
                        <Link to={`/proyectos/${p.id}`} aria-label={`Abrir ${p.nombre}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none' }}>
                          ›
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-muted" style={{ padding: 32, textAlign: 'center', borderBottom: 0 }}>
                      {lista.length === 0
                        ? 'Aún no hay proyectos. Crea el primero para empezar a trazar postes.'
                        : 'Ningún proyecto coincide con el filtro.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            Mostrando {visibles.length} de {lista.length} {lista.length === 1 ? 'proyecto' : 'proyectos'}
          </div>
        </>
      )}
    </div>
  )
}

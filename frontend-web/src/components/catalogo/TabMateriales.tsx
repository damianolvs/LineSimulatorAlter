// frontend-web/src/components/catalogo/TabMateriales.tsx
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { EstructuraNormativa, MaterialCatalogo } from '../../api/tipos'

const MAX_CODIGOS = 6

interface Props {
  materiales: MaterialCatalogo[]
  estructuras: EstructuraNormativa[]
  /** Abre la pestaña de estructuras con esa estructura seleccionada. */
  onVerEstructura: (codigo: string) => void
}

export default function TabMateriales({ materiales, estructuras, onVerEstructura }: Props) {
  const [busqueda, setBusqueda] = useState('')

  // En qué estructuras aparece cada material, según sus reglas.
  const usoPorMaterial = useMemo(() => {
    const uso = new Map<string, string[]>()
    for (const e of estructuras) {
      for (const codigo of new Set(e.materiales.map((m) => m.material_codigo))) {
        uso.set(codigo, [...(uso.get(codigo) ?? []), e.codigo])
      }
    }
    return uso
  }, [estructuras])

  const visibles = materiales.filter((m) => {
    const texto = busqueda.trim().toLowerCase()
    return !texto || `${m.nombre} ${m.codigo}`.toLowerCase().includes(texto)
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <Search size={14} strokeWidth={2} className="absolute left-[9px] top-[11px]" style={{ color: 'var(--color-neutral-600)' }} />
          <input
            className="input"
            style={{ width: 250, paddingLeft: 28 }}
            placeholder="Buscar material o código"
            aria-label="Buscar material"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <span className="text-muted ml-auto" style={{ fontSize: 12 }}>
          {materiales.length} materiales
        </span>
      </div>

      <div
        style={{ border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', background: 'var(--color-neutral-100)', overflow: 'hidden' }}
      >
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 18, width: '34%' }}>Material</th>
              <th>Código</th>
              <th>Unidad</th>
              <th>Se usa en</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((m, i) => {
              const uso = usoPorMaterial.get(m.codigo) ?? []
              const borde = i === visibles.length - 1 ? { borderBottom: 0 } : undefined
              return (
                <tr key={m.id}>
                  <td style={{ paddingLeft: 18, ...borde }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>{m.nombre}</span>
                    {m.cantidad_estimada && (
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        Cantidad estimada, por validar contra catálogo real
                      </div>
                    )}
                  </td>
                  <td className="num" style={borde}>
                    {m.codigo}
                  </td>
                  <td style={borde}>{m.unidad.toLowerCase()}</td>
                  <td style={borde}>
                    {uso.length === 0 ? (
                      <span className="text-muted">Ninguna estructura</span>
                    ) : (
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ fontSize: 13 }}>
                        {uso.slice(0, MAX_CODIGOS).map((codigo) => (
                          <button
                            key={codigo}
                            type="button"
                            className="btn btn-ghost num"
                            style={{ padding: '0 4px', fontSize: 13 }}
                            title={`Ver ${codigo} en el catálogo`}
                            onClick={() => onVerEstructura(codigo)}
                          >
                            {codigo}
                          </button>
                        ))}
                        {uso.length > MAX_CODIGOS && <span className="text-muted num">+{uso.length - MAX_CODIGOS}</span>}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted" style={{ padding: 32, textAlign: 'center', borderBottom: 0 }}>
                  Ningún material coincide con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

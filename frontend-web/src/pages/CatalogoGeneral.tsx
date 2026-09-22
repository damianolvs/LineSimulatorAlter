// src/pages/CatalogoGeneral.tsx — catálogo CFE: estructuras, materiales y componentes de dibujo
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  listarComponentesVisuales,
  listarEstructurasNormativas,
  listarMaterialesCatalogo,
  listarPrefijos,
} from '../api/proyectos'
import TabComponentes from '../components/catalogo/TabComponentes'
import TabEstructuras from '../components/catalogo/TabEstructuras'
import TabMateriales from '../components/catalogo/TabMateriales'
import { useCargar } from '../hooks/useCargar'

type Vista = 'estructuras' | 'materiales' | 'componentes'

const VISTAS: { id: Vista; etiqueta: string }[] = [
  { id: 'estructuras', etiqueta: 'Estructuras' },
  { id: 'materiales', etiqueta: 'Materiales' },
  { id: 'componentes', etiqueta: 'Componentes' },
]

const esVista = (valor: string | null): valor is Vista => VISTAS.some((v) => v.id === valor)

export default function CatalogoGeneral() {
  // La vista y la estructura elegida viven en la URL: se pueden compartir y sobreviven a recargar.
  const [params, setParams] = useSearchParams()
  const vista: Vista = esVista(params.get('vista')) ? (params.get('vista') as Vista) : 'estructuras'
  const seleccion = params.get('e')

  const { datos, cargando, error } = useCargar(
    () =>
      Promise.all([
        listarEstructurasNormativas(),
        listarPrefijos(),
        listarMaterialesCatalogo(),
        listarComponentesVisuales(),
      ]),
    [],
  )
  const [estructuras, prefijos, materiales, componentes] = datos ?? [[], [], [], []]

  const usadoPor = useMemo(() => {
    const uso = new Map<string, string[]>()
    for (const m of materiales) {
      if (m.componente_visual_codigo) {
        uso.set(m.componente_visual_codigo, [...(uso.get(m.componente_visual_codigo) ?? []), m.nombre])
      }
    }
    return uso
  }, [materiales])

  const irA = (nueva: Vista, estructura?: string) => {
    const siguiente = new URLSearchParams(params)
    siguiente.set('vista', nueva)
    if (estructura) siguiente.set('e', estructura)
    setParams(siguiente, { replace: true })
  }

  return (
    <div className="flex flex-col gap-5 px-10 py-7">
      <div className="flex items-end gap-6">
        <div>
          <h2 style={{ margin: '0 0 2px' }}>Catálogo CFE</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Estructuras de media tensión, materiales y piezas de dibujo · Construcción de Instalaciones Aéreas en Media y Baja
            Tensión (CFE DCCIAMBT)
          </div>
        </div>
        <div className="seg ml-auto">
          {VISTAS.map((v) => (
            <label key={v.id} className="seg-opt">
              <input type="radio" name="vista-catalogo" checked={vista === v.id} onChange={() => irA(v.id)} />
              {v.etiqueta}
            </label>
          ))}
        </div>
      </div>

      {error && <p role="alert">No se pudo cargar el catálogo: {error}</p>}
      {cargando && !datos && <p className="text-muted">Cargando…</p>}

      {datos && vista === 'estructuras' && (
        <TabEstructuras
          estructuras={estructuras}
          prefijos={prefijos}
          seleccion={seleccion}
          onSeleccionar={(codigo) => irA('estructuras', codigo)}
        />
      )}
      {datos && vista === 'materiales' && (
        <TabMateriales materiales={materiales} estructuras={estructuras} onVerEstructura={(codigo) => irA('estructuras', codigo)} />
      )}
      {datos && vista === 'componentes' && <TabComponentes componentes={componentes} usadoPor={usadoPor} />}
    </div>
  )
}

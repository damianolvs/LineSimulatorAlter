// frontend-web/src/components/catalogo/TabComponentes.tsx
import type { ComponenteVisual } from '../../api/tipos'
import { CODIGOS_CON_DIBUJO } from '../../pages/SpriteDefs'

interface Props {
  componentes: ComponenteVisual[]
  /** Materiales dibujados con cada componente (Material.componente_visual), por código de componente. */
  usadoPor: Map<string, string[]>
}

/** Piezas con las que se dibuja cada poste. Requiere <SpriteDefs /> montado en el layout. */
export default function TabComponentes({ componentes, usadoPor }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted" style={{ margin: 0, fontSize: 13, maxWidth: 640 }}>
        Símbolos que se colocan sobre el diagrama del poste. Cada material del catálogo que tiene una pieza asociada se dibuja con
        ella; los materiales sin pieza (bastidor, tirante…) cuentan en la lista de materiales pero no se dibujan.
      </p>
      <div className="grid grid-cols-4 gap-4">
        {componentes.map((c) => {
          const dibujado = CODIGOS_CON_DIBUJO.includes(c.codigo)
          const materiales = usadoPor.get(c.codigo) ?? []
          return (
            <div key={c.id} className="card">
              <div
                className="grid h-28 place-items-center"
                style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-divider)' }}
              >
                {dibujado ? (
                  <svg width="88" height="88" aria-label={`Dibujo de ${c.nombre}`} role="img">
                    <use href={`#${c.codigo}`} width="88" height="88" />
                  </svg>
                ) : (
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    Sin dibujo todavía
                  </span>
                )}
              </div>
              <div className="card-kicker num">{c.codigo}</div>
              <div className="card-title">{c.nombre}</div>
              <div className="card-meta num">
                {c.ancho_px} × {c.alto_px} · capa {c.z_index}
              </div>
              <div className="card-meta" style={{ flexWrap: 'wrap' }}>
                {materiales.length === 0 ? 'Sin materiales asociados' : `Dibuja: ${materiales.join(', ')}`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

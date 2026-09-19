// src/pages/ProyectoNuevo.tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { crearProyecto } from '../api/proyectos'
import type { TensionKv } from '../api/tipos'

const TENSIONES: TensionKv[] = [13.8, 34.5]

export default function ProyectoNuevo() {
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tension, setTension] = useState<TensionKv>(13.8)
  const [vanoMaximo, setVanoMaximo] = useState('109')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const proyecto = await crearProyecto({
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim(),
        descripcion: descripcion.trim(),
        tension_kv: tension,
        vano_maximo: Number(vanoMaximo),
      })
      navigate(`/proyectos/${proyecto.id}`)
    } catch (err) {
      setError((err as Error).message)
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-9">
      <h2 style={{ margin: '0 0 2px' }}>Nuevo proyecto</h2>
      <div className="text-muted" style={{ fontSize: 13 }}>
        Al crearlo se abre el editor de mapa de su primer tramo, donde trazas la línea.
      </div>

      <form
        onSubmit={enviar}
        className="mt-6 flex flex-col gap-4 p-6"
        style={{ border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', background: 'var(--color-neutral-100)' }}
      >
        <div className="field">
          <label htmlFor="nombre">Nombre *</label>
          <input id="nombre" className="input" required autoFocus maxLength={150} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="ubicacion">Ubicación</label>
          <input id="ubicacion" className="input" maxLength={200} value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="descripcion">Descripción</label>
          <textarea id="descripcion" className="input" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="field">
            <label>Tensión nominal</label>
            <div className="seg">
              {TENSIONES.map((t) => (
                <label key={t} className="seg-opt">
                  <input type="radio" name="tension" checked={tension === t} onChange={() => setTension(t)} />
                  <span className="num">{t} kV</span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="vano">Vano máximo (m)</label>
            <input
              id="vano"
              className="input num"
              type="number"
              min={1}
              step="any"
              required
              value={vanoMaximo}
              onChange={(e) => setVanoMaximo(e.target.value)}
            />
            <div className="text-muted" style={{ fontSize: 11, marginTop: 5 }}>
              Con él se generan los postes de paso. Estándar CFE: 109 m.
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" style={{ margin: 0, color: 'var(--color-accent-700)', fontSize: 13 }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <Link to="/proyectos" className="btn btn-secondary no-underline" style={{ color: 'var(--color-text)' }}>
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={guardando || !nombre.trim()}>
            {guardando ? 'Creando…' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </div>
  )
}

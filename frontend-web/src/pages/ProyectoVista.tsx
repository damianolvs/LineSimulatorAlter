// src/pages/ProyectoVista.tsx — editor de mapa (mockup 1b) con el modal de configuración de poste (1c)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FileText, MapPinned, MousePointer2, Route, Spline, TowerControl, X } from 'lucide-react'
import {
  actualizarPoste,
  actualizarProyecto,
  actualizarTramo,
  agregarPostesPorCoordenadas,
  borrarPoste,
  crearPoste,
  generarPostesDePaso,
  listarComponentesVisuales,
  listarEstructuras,
  listarPrefijos,
  listarTramos,
  moverPoste,
  obtenerOpcionesPoste,
  obtenerProyecto,
} from '../api/proyectos'
import type { DatosPoste, EstadoProyecto, EstructuraCFE } from '../api/tipos'
import ModalCoordenadas from '../components/ModalCoordenadas'
import BarraProyecto from '../components/BarraProyecto'
import MapaTramo, { BASES, type BaseMapa, type Herramienta } from '../components/MapaTramo'
import ModalPoste from '../components/ModalPoste'
import PanelPoste from '../components/PanelPoste'
import SelectorEstructura from '../components/SelectorEstructura'
import { useCargar } from '../hooks/useCargar'
import { useTramoConPostes } from '../hooks/useTramoConPostes'
import { CLASE_ESTADO, ETIQUETA_ESTADO, codigoPoste, formatearCoordenadas, formatearHora, formatearKm, formatearNumero } from '../lib/formato'
import { distanciaM } from '../lib/geo'

const HERRAMIENTAS: { id: Herramienta; nombre: string; atajo: string; icono: typeof Route }[] = [
  { id: 'seleccionar', nombre: 'Seleccionar / mover', atajo: 'V', icono: MousePointer2 },
  { id: 'trazar', nombre: 'Trazar trayectoria', atajo: 'L', icono: Route },
  { id: 'poste', nombre: 'Colocar poste', atajo: 'P', icono: TowerControl },
]

/** Estructura sugerida cuando el usuario aún no elige: la de paso simple más común (TS3N), o la primera con reglas. */
function estructuraSugerida(estructuras: EstructuraCFE[]): number | null {
  return (
    estructuras.find((e) => e.codigo === 'TS3N') ??
    estructuras.find((e) => e.estructura_mt) ??
    estructuras[0]
  )?.id ?? null
}

const escribiendo = (e: KeyboardEvent) =>
  e.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)

export default function ProyectoVista() {
  const { id } = useParams()
  const proyecto = useCargar(() => obtenerProyecto(id!), [id])
  const tramos = useCargar(() => listarTramos(id!), [id])
  const catalogo = useCargar(
    () => Promise.all([listarEstructuras(), listarPrefijos(), obtenerOpcionesPoste(), listarComponentesVisuales()]),
    [],
  )

  const [tramoElegido, setTramoElegido] = useState<number | null>(null)
  const tramoId = tramoElegido ?? tramos.datos?.[0]?.id
  const tramo = tramos.datos?.find((t) => t.id === tramoId)
  const { postes, error: errorPostes, recargar } = useTramoConPostes(tramoId)

  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [coordenadasAbierto, setCoordenadasAbierto] = useState(false)
  const [enfoque, setEnfoque] = useState<{ clave: number; puntos: [number, number][] } | null>(null)
  const [herramienta, setHerramienta] = useState<Herramienta>('seleccionar')
  const [base, setBase] = useState<BaseMapa>('satelite')
  const [mostrarVanos, setMostrarVanos] = useState(true)
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(true)
  const [centro, setCentro] = useState<[number, number] | null>(null)
  const [estructuraNuevaId, setEstructuraNuevaId] = useState<number | null>(null)
  const [estructuraPasoId, setEstructuraPasoId] = useState<number | null>(null)
  const [vanoMaximo, setVanoMaximo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const [estructuras, prefijos, opciones, componentesVisuales] = catalogo.datos ?? [[], [], null, []]
  const nuevaId = estructuraNuevaId ?? estructuraSugerida(estructuras)
  const pasoId = estructuraPasoId ?? estructuraSugerida(estructuras)
  const ordenados = useMemo(() => [...postes].sort((a, b) => a.orden - b.orden), [postes])
  const indiceSeleccionado = ordenados.findIndex((p) => p.id === seleccionadoId)
  const seleccionado = indiceSeleccionado >= 0 ? ordenados[indiceSeleccionado] : null

  const { recargar: recargarProyecto } = proyecto

  /** Ejecuta una mutación, recarga los postes y el resumen del proyecto, y reporta el error si falla. */
  const ejecutar = useCallback(
    async (accion: () => Promise<unknown>) => {
      setOcupado(true)
      setAviso(null)
      try {
        await accion()
        recargar()
        recargarProyecto()
      } catch (err) {
        setAviso((err as Error).message)
      } finally {
        setOcupado(false)
      }
    },
    [recargar, recargarProyecto],
  )

  // Atajos de herramienta, como indica el mockup: V seleccionar, L trazar, P colocar; Esc vuelve a seleccionar.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (escribiendo(e) || e.ctrlKey || e.metaKey || e.altKey || modalAbierto) return
      const tecla = e.key.toLowerCase()
      if (tecla === 'v' || tecla === 'escape') setHerramienta('seleccionar')
      else if (tecla === 'l') setHerramienta('trazar')
      else if (tecla === 'p') setHerramienta('poste')
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [modalAbierto])

  const colocar = (posicion: [number, number]) => {
    if (tramoId === undefined || nuevaId === null) return
    // Un poste nuevo hereda altura, resistencia y terreno del último, que en una línea suelen repetirse.
    const ultimo = ordenados.at(-1)
    const datos: DatosPoste = {
      estructura_id: nuevaId,
      altura_m: ultimo?.alturaM ?? 12,
      resistencia_kg: ultimo?.resistenciaKg ?? 750,
      tipo_terreno: ultimo?.tipoTerreno ?? 'normal',
    }
    void ejecutar(async () => {
      const creado = await crearPoste(tramoId, posicion, datos)
      setSeleccionadoId(creado.properties.id)
      if (herramienta === 'poste') setHerramienta('seleccionar')
    })
  }

  /** Crea los postes de la ventana de coordenadas. Lanza si falla, para que la ventana muestre el error. */
  const crearPorCoordenadas = async (puntos: [number, number][], estructuraId: number) => {
    if (tramoId === undefined) return
    const ultimo = ordenados.at(-1)
    await agregarPostesPorCoordenadas(tramoId, puntos, {
      estructura_id: estructuraId,
      altura_m: ultimo?.alturaM ?? 12,
      resistencia_kg: ultimo?.resistenciaKg ?? 750,
      tipo_terreno: ultimo?.tipoTerreno ?? 'normal',
    })
    recargar()
    recargarProyecto()
    setEnfoque({ clave: Date.now(), puntos: [...ordenados.map((p) => p.posicion), ...puntos] })
  }

  const moverACoordenadas = (posicion: [number, number]) => {
    if (!seleccionado) return
    void ejecutar(async () => {
      await moverPoste(seleccionado.id, posicion)
      setEnfoque({ clave: Date.now(), puntos: [posicion] })
    })
  }

  const eliminar = () => {
    if (!seleccionado || !window.confirm(`¿Eliminar el poste ${codigoPoste(seleccionado.orden)}?`)) return
    void ejecutar(async () => {
      await borrarPoste(seleccionado.id)
      setSeleccionadoId(null)
      setModalAbierto(false)
    })
  }

  const aplicarATramo = () => {
    if (!seleccionado) return
    const otros = ordenados.filter((p) => p.id !== seleccionado.id)
    if (
      otros.length === 0 ||
      !window.confirm(
        `Se aplicarán la estructura ${seleccionado.estructura.codigo}, ${seleccionado.alturaM} m / ${seleccionado.resistenciaKg} kg y terreno ${seleccionado.tipoTerreno} a los otros ${otros.length} postes del tramo. ¿Continuar?`,
      )
    ) {
      return
    }
    const datos: DatosPoste = {
      estructura_id: seleccionado.estructura.id,
      altura_m: seleccionado.alturaM,
      resistencia_kg: seleccionado.resistenciaKg,
      tipo_terreno: seleccionado.tipoTerreno,
    }
    // En serie: cada cambio recalcula los componentes automáticos y la línea del tramo.
    void ejecutar(async () => {
      for (const poste of otros) await actualizarPoste(poste.id, datos)
    })
  }

  const generarPasos = () => {
    if (tramoId === undefined) return
    if (
      ordenados.some((p) => !p.esAncla) &&
      !window.confirm('Se reemplazarán los postes de paso actuales, incluidos los ajustes manuales que tengan. ¿Continuar?')
    ) {
      return
    }
    void ejecutar(async () => {
      await generarPostesDePaso(tramoId, pasoId ?? undefined)
      setSeleccionadoId(null)
    })
  }

  const guardarVano = () => {
    if (tramoId === undefined || vanoMaximo === null) return
    const valor = Number(vanoMaximo)
    if (!(valor >= 1) || valor === tramo?.vano_maximo) {
      setVanoMaximo(null)
      return
    }
    void ejecutar(async () => {
      await actualizarTramo(tramoId, { vano_maximo: valor })
      tramos.recargar()
      setVanoMaximo(null)
    })
  }

  const cambiarEstado = (estado: EstadoProyecto) => {
    if (!proyecto.datos) return
    void ejecutar(() => actualizarProyecto(proyecto.datos!.id, { estado }))
  }

  const errorCarga = proyecto.error ?? tramos.error ?? catalogo.error
  if (errorCarga) {
    return (
      <div className="p-10">
        No se pudo cargar el proyecto: {errorCarga}. <Link to="/proyectos">Volver a proyectos</Link>
      </div>
    )
  }
  if (!proyecto.datos || !tramos.datos || !opciones) return <p className="p-10 text-muted">Cargando…</p>
  if (tramoId === undefined) return <p className="p-10 text-muted">Este proyecto no tiene tramos.</p>

  const datosProyecto = proyecto.datos
  const anclas = ordenados.filter((p) => p.esAncla).length
  const vano = (a?: (typeof ordenados)[number], b?: (typeof ordenados)[number]) =>
    a && b ? distanciaM(a.posicion, b.posicion) : null
  const anterior = indiceSeleccionado > 0 ? ordenados[indiceSeleccionado - 1] : undefined
  const siguiente = indiceSeleccionado >= 0 ? ordenados[indiceSeleccionado + 1] : undefined
  const irA = (poste?: (typeof ordenados)[number]) => (poste ? () => setSeleccionadoId(poste.id) : null)
  const mensajeError = aviso ?? errorPostes

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--color-bg)' }}>
      <BarraProyecto
        volverA="/proyectos"
        etiquetaVolver="Proyectos"
        titulo={datosProyecto.nombre}
        acciones={
          <Link to={`/proyectos/${datosProyecto.id}/materiales`} className="btn btn-primary no-underline">
            <FileText size={14} strokeWidth={1.8} />
            Generar BOM
          </Link>
        }
      >
        <select
          aria-label="Estado del proyecto"
          title="Cambiar el estado del proyecto"
          value={datosProyecto.estado}
          disabled={ocupado}
          onChange={(e) => cambiarEstado(e.target.value as EstadoProyecto)}
          className={`tag ${CLASE_ESTADO[datosProyecto.estado]}`}
          style={{ appearance: 'none', cursor: 'pointer', border: datosProyecto.estado === 'aprobado' ? undefined : 0 }}
        >
          {(Object.keys(ETIQUETA_ESTADO) as EstadoProyecto[]).map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO[e]}
            </option>
          ))}
        </select>
        <span className="text-muted num" style={{ fontSize: 12 }}>
          {datosProyecto.tension_kv} kV · {datosProyecto.num_postes} postes · {formatearKm(datosProyecto.longitud_m)} ·
          guardado {formatearHora(new Date(datosProyecto.actualizado_en))}
        </span>
        {tramos.datos.length > 1 && (
          <select
            aria-label="Tramo"
            className="input"
            style={{ width: 'auto', minHeight: 30, padding: '2px 8px', fontSize: 13 }}
            value={tramoId}
            onChange={(e) => {
              setTramoElegido(Number(e.target.value))
              setSeleccionadoId(null)
            }}
          >
            {tramos.datos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre || `Tramo ${t.id}`}
              </option>
            ))}
          </select>
        )}
      </BarraProyecto>

      <div className="flex min-h-0 flex-1">
        {/* Herramientas */}
        <div
          className="flex w-64 flex-none flex-col overflow-auto"
          style={{ borderRight: '1px solid var(--color-divider)', background: 'var(--color-neutral-100)' }}
        >
          <div className="px-4 pb-2.5 pt-3.5">
            <h6 style={{ margin: 0 }}>Herramientas</h6>
          </div>
          <div className="flex flex-col gap-0.5 px-2.5">
            {HERRAMIENTAS.map(({ id: clave, nombre, atajo, icono: Icono }) => (
              <button
                key={clave}
                type="button"
                aria-pressed={herramienta === clave}
                onClick={() => setHerramienta(clave)}
                className={`tool flex cursor-pointer items-center gap-2.5 bg-transparent px-2.5 py-2 text-left text-[13.5px] ${herramienta === clave ? 'toolsel' : ''}`}
                style={{ borderRadius: 'var(--radius-md)', font: 'inherit', fontSize: 13.5, border: 0 }}
              >
                <Icono size={17} strokeWidth={1.7} />
                {nombre}
                <span className="num text-muted ml-auto" style={{ fontSize: 11 }}>
                  {atajo}
                </span>
              </button>
            ))}
          </div>

          <hr className="hr" style={{ margin: '14px 16px' }} />

          <div className="px-4">
            <h6 style={{ margin: '0 0 8px' }}>Estructura por defecto</h6>
            <SelectorEstructura
              aria-label="Estructura para postes nuevos"
              estructuras={estructuras}
              prefijos={prefijos}
              valor={nuevaId}
              onCambiar={setEstructuraNuevaId}
            />
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="vano-maximo">Vano máximo del tramo</label>
              <div className="flex items-center gap-2">
                <input
                  id="vano-maximo"
                  className="input num"
                  type="number"
                  min={1}
                  step="any"
                  style={{ width: 72 }}
                  value={vanoMaximo ?? tramo?.vano_maximo ?? ''}
                  onChange={(e) => setVanoMaximo(e.target.value)}
                  onBlur={guardarVano}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
                <span className="text-muted" style={{ fontSize: 12 }}>
                  m · estándar CFE 109 m
                </span>
              </div>
            </div>
          </div>

          <hr className="hr" style={{ margin: '14px 16px' }} />

          <div className="px-4">
            <h6 style={{ margin: '0 0 8px' }}>Coordenadas</h6>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: 0 }}
              disabled={nuevaId === null}
              onClick={() => setCoordenadasAbierto(true)}
            >
              <MapPinned size={15} strokeWidth={1.8} />
              Ingresar postes por coordenadas
            </button>
            <div className="text-muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              Opcional: solo inicio y fin, o todos los puntos. Para mover un poste existente, selecciónalo y edita su ubicación.
            </div>
          </div>

          <hr className="hr" style={{ margin: '14px 16px' }} />

          <div className="px-4">
            <h6 style={{ margin: '0 0 8px' }}>Postes de paso</h6>
            <SelectorEstructura
              aria-label="Estructura de los postes de paso"
              estructuras={estructuras}
              prefijos={prefijos}
              valor={pasoId}
              onCambiar={setEstructuraPasoId}
            />
            <button
              type="button"
              className="btn btn-secondary btn-block"
              disabled={ocupado || anclas < 2}
              title={anclas < 2 ? 'Coloca al menos 2 postes ancla' : undefined}
              onClick={generarPasos}
            >
              <Spline size={15} strokeWidth={1.8} />
              Generar postes de paso
            </button>
          </div>

          <hr className="hr" style={{ margin: '14px 16px' }} />

          <div className="px-4 pb-4">
            <h6 style={{ margin: '0 0 8px' }}>Capas</h6>
            <div className="flex flex-col gap-1.5" style={{ fontSize: 13 }}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={mostrarVanos} onChange={(e) => setMostrarVanos(e.target.checked)} style={{ accentColor: '#b68235' }} />
                Etiquetas de vano
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={mostrarEtiquetas} onChange={(e) => setMostrarEtiquetas(e.target.checked)} style={{ accentColor: '#b68235' }} />
                Etiquetas de poste
              </label>
            </div>
          </div>

          <div className="text-muted num mt-auto px-4 py-3" style={{ borderTop: '1px solid var(--color-divider)', fontSize: 11 }}>
            {centro ? formatearCoordenadas(centro, 4) : '—'} · {BASES[base].nombre}
          </div>
        </div>

        {/* Mapa */}
        <div className="relative min-w-0 flex-1 overflow-hidden" style={{ background: '#3f4a3a' }}>
          <MapaTramo
            postes={postes}
            seleccionadoId={seleccionadoId}
            herramienta={herramienta}
            base={base}
            onCambiarBase={setBase}
            mostrarVanos={mostrarVanos}
            mostrarEtiquetas={mostrarEtiquetas}
            onSeleccionar={(posteId) => {
              setSeleccionadoId(posteId)
              setHerramienta('seleccionar')
            }}
            onColocar={colocar}
            onMover={(posteId, posicion) => void ejecutar(() => moverPoste(posteId, posicion))}
            onCentro={setCentro}
            enfoque={enfoque}
          />

          {(herramienta !== 'seleccionar' || postes.length === 0) && (
            <div
              className="pointer-events-none absolute bottom-3.5 left-1/2 z-[1000] -translate-x-1/2 px-3 py-1.5 text-[12.5px]"
              style={{ background: 'rgba(25,23,20,.78)', color: '#f4ead8', borderRadius: 2 }}
            >
              {herramienta === 'seleccionar'
                ? 'Este tramo aún no tiene postes: elige «Trazar trayectoria» (L) y haz clic en el mapa'
                : herramienta === 'trazar'
                  ? 'Haz clic para ir colocando postes · Esc para terminar'
                  : 'Haz clic en el mapa para colocar un poste'}
            </div>
          )}

          {mensajeError && (
            <div
              role="alert"
              className="card absolute left-1/2 top-3.5 z-[1000] flex -translate-x-1/2 flex-row items-center gap-3 px-3.5 py-2 text-[13px]"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-accent)', boxShadow: 'var(--shadow-md)' }}
            >
              {mensajeError}
              {aviso && (
                <button type="button" className="btn btn-ghost" aria-label="Cerrar aviso" onClick={() => setAviso(null)}>
                  <X size={15} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Propiedades */}
        <div
          className="flex w-[330px] flex-none flex-col overflow-hidden"
          style={{ borderLeft: '1px solid var(--color-divider)', background: 'var(--color-neutral-100)' }}
        >
          {seleccionado ? (
            <PanelPoste
              poste={seleccionado}
              estructuras={estructuras}
              prefijos={prefijos}
              opciones={opciones}
              vanoAnteriorM={vano(anterior, seleccionado)}
              vanoSiguienteM={vano(seleccionado, siguiente)}
              ocupado={ocupado}
              onCambiar={(cambios) => void ejecutar(() => actualizarPoste(seleccionado.id, cambios))}
              onMoverACoordenadas={moverACoordenadas}
              onConfigurar={() => setModalAbierto(true)}
              onAplicarATramo={aplicarATramo}
              onEliminar={eliminar}
            />
          ) : (
            <div className="flex flex-col gap-4 overflow-auto px-[18px] py-4">
              <h3 style={{ margin: 0, fontSize: 21 }}>Resumen del tramo</h3>
              {postes.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
                  Sin postes todavía. Traza la trayectoria con la herramienta <strong>L</strong>, y después selecciona un poste para
                  elegir su estructura y ver sus componentes.
                </p>
              ) : (
                <>
                  <table className="table" style={{ fontSize: 13 }}>
                    <tbody>
                      {[
                        ['Postes', `${postes.length} (${anclas} ancla${anclas === 1 ? '' : 's'}, ${postes.length - anclas} de paso)`],
                        ['Longitud de línea', formatearKm(datosProyecto.longitud_m)],
                        ['Vano máximo', `${formatearNumero(tramo?.vano_maximo ?? 0, 0)} m`],
                        ['Tensión', `${datosProyecto.tension_kv} kV`],
                      ].map(([nombre, valor]) => (
                        <tr key={nombre}>
                          <td style={{ paddingLeft: 0 }}>{nombre}</td>
                          <td className="num" style={{ textAlign: 'right', paddingRight: 0 }}>
                            {valor}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
                    Selecciona un poste en el mapa para editarlo. Con dos o más anclas puedes generar los postes de paso.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {coordenadasAbierto && (
        <ModalCoordenadas
          tramoVacio={ordenados.length === 0}
          ultimoPoste={ordenados.length ? codigoPoste(ordenados[ordenados.length - 1].orden) : null}
          estructuras={estructuras}
          prefijos={prefijos}
          estructuraInicialId={nuevaId}
          onCrear={crearPorCoordenadas}
          onCerrar={() => setCoordenadasAbierto(false)}
        />
      )}

      {modalAbierto && seleccionado && (
        <ModalPoste
          proyectoNombre={datosProyecto.nombre}
          poste={seleccionado}
          posicion={indiceSeleccionado + 1}
          total={ordenados.length}
          vecinos={`${codigoPoste((anterior ?? seleccionado).orden)} – ${codigoPoste((siguiente ?? seleccionado).orden)}`}
          estructuras={estructuras}
          prefijos={prefijos}
          catalogo={componentesVisuales}
          onCambiarEstructura={(estructuraId) => void ejecutar(() => actualizarPoste(seleccionado.id, { estructura_id: estructuraId }))}
          onAnterior={irA(anterior)}
          onSiguiente={irA(siguiente)}
          onCerrar={() => setModalAbierto(false)}
          onCambio={() => {
            recargar()
            recargarProyecto()
          }}
          onError={setAviso}
        />
      )}
    </div>
  )
}

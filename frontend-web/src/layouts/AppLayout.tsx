// src/layouts/AppLayout.tsx — páginas con barra de navegación superior (mockup 1a)
import { NavLink, Outlet } from 'react-router-dom'
import MetalDefs from '../components/MetalDefs'
import { SpriteDefs } from '../pages/SpriteDefs'

const ENLACES = [
  { to: '/proyectos', etiqueta: 'Proyectos' },
  { to: '/catalogo', etiqueta: 'Catálogo CFE' },
  { to: '/configuracion', etiqueta: 'Configuración' },
]

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--color-bg)' }}>
      <MetalDefs />
      <SpriteDefs />
      <nav className="nav" style={{ padding: '12px 24px', background: 'var(--color-neutral-100)' }}>
        <span className="nav-brand flex items-center gap-2.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b68235" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 2v20" />
            <path d="M4 6h16" />
            <path d="M6 10h12" />
            <path d="M12 12 4 22" />
            <path d="m12 12 8 10" />
          </svg>
          LineSimulatorAlter
        </span>
        {ENLACES.map(({ to, etiqueta }) => (
          <NavLink key={to} to={to}>
            {etiqueta}
          </NavLink>
        ))}
      </nav>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}

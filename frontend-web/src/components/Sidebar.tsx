// src/components/Sidebar.tsx
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, BookOpen, Settings } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/proyectos', label: 'Proyectos', icon: FolderKanban },
  { to: '/catalogo', label: 'Catálogo', icon: BookOpen },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-200 min-h-screen flex flex-col">
      <div className="px-4 py-5 text-lg font-bold tracking-tight border-b border-slate-800">
        LineSimulator
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
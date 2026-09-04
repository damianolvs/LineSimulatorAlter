// src/App.tsx
import { Routes, Route } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import ProyectosLista from './pages/ProyectosLista'
import ProyectoNuevo from './pages/ProyectoNuevo'
import ProyectoVista from './pages/ProyectoVista'
import ProyectoMateriales from './pages/ProyectoMateriales'
import CatalogoGeneral from './pages/CatalogoGeneral'
import Configuracion from './pages/Configuracion'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/proyectos" element={<ProyectosLista />} />
        <Route path="/proyectos/nuevo" element={<ProyectoNuevo />} />
        <Route path="/proyectos/:id" element={<ProyectoVista />} />
        <Route path="/proyectos/:id/materiales" element={<ProyectoMateriales />} />
        <Route path="/catalogo" element={<CatalogoGeneral />} />
        <Route path="/configuracion" element={<Configuracion />} />
      </Route>
    </Routes>
  )
}

export default App
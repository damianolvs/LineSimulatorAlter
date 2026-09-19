// src/App.tsx
import { Navigate, Routes, Route } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import EditorLayout from './layouts/EditorLayout'
import ProyectosLista from './pages/ProyectosLista'
import ProyectoNuevo from './pages/ProyectoNuevo'
import ProyectoVista from './pages/ProyectoVista'
import ProyectoMateriales from './pages/ProyectoMateriales'
import CatalogoGeneral from './pages/CatalogoGeneral'
import Configuracion from './pages/Configuracion'
import { PruebaSprites } from './pages/PruebaSprites'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/proyectos" replace />} />
        <Route path="/proyectos" element={<ProyectosLista />} />
        <Route path="/proyectos/nuevo" element={<ProyectoNuevo />} />
        <Route path="/catalogo" element={<CatalogoGeneral />} />
        <Route path="/configuracion" element={<Configuracion />} />
      </Route>
      <Route element={<EditorLayout />}>
        <Route path="/proyectos/:id" element={<ProyectoVista />} />
        <Route path="/proyectos/:id/materiales" element={<ProyectoMateriales />} />
      </Route>
      <Route path="/prueba-sprites" element={<PruebaSprites />} />
    </Routes>
  )
}

export default App

// src/layouts/EditorLayout.tsx — pantallas de trabajo a pantalla completa (mockups 1b y 1d)
import { Outlet } from 'react-router-dom'
import MetalDefs from '../components/MetalDefs'
import { SpriteDefs } from '../pages/SpriteDefs'

export default function EditorLayout() {
  return (
    <>
      <MetalDefs />
      <SpriteDefs />
      <Outlet />
    </>
  )
}

import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { useBrandAssets } from '../../hooks/useBrandAssets'

import { LandingFooter } from './LandingFooter'

import '../../pages/LandingPage.css'

export function PublicLayout({ children }: { children: ReactNode }) {
  const { logo } = useBrandAssets()
  return (
    <div className="landing">
      <header className="landing__header">
        <Link to="/" className="landing__home" aria-label="Intelligent Nutrition, ir al inicio">
          <img className="landing__logo" src={logo} alt="" />
        </Link>
        <nav className="landing__nav" aria-label="Navegación del sitio">
          <NavLink className="landing__nav-catalog" to="/productos">
            Productos
          </NavLink>
          <Link to="/#sedes">Sedes</Link>
          <Link to="/#contacto">Contacto</Link>
          <Link className="landing__login" to="/login">
            Ingreso
          </Link>
        </nav>
      </header>
      {children}
      <LandingFooter logo={logo} />
    </div>
  )
}

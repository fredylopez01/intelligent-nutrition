import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { CartProvider } from '../../context/CartContext'
import { useBrandAssets } from '../../hooks/useBrandAssets'
import { useCart } from '../../hooks/useCart'
import { ChatWidget } from '../chat/ChatWidget'

import { LandingFooter } from './LandingFooter'

import '../../pages/LandingPage.css'
import './PublicLayout.css'

function CartLink() {
  const { count } = useCart()
  return (
    <NavLink
      className="public-cart-link"
      to="/pedido"
      aria-label={count > 0 ? `Mi pedido, ${count} productos` : 'Mi pedido'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 7h14l-1.3 10.2a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8L5 7Z" />
        <path d="M9 7V6a3 3 0 0 1 6 0v1" />
      </svg>
      <span className="public-cart-link__label">Mi pedido</span>
      {count > 0 && (
        <span className="public-cart-link__count" aria-hidden="true">
          {count}
        </span>
      )}
    </NavLink>
  )
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const { logo } = useBrandAssets()
  return (
    <CartProvider>
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
            <CartLink />
            <Link className="landing__login" to="/login">
              Ingreso
            </Link>
          </nav>
        </header>
        {children}
        <LandingFooter logo={logo} />
        <ChatWidget variant="public" />
      </div>
    </CartProvider>
  )
}

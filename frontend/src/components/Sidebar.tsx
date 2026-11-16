import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { useBrandAssets } from '../hooks/useBrandAssets'
import { canAccess } from '../routes/access'

import './Sidebar.css'

type NavIconName =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'catalog'
  | 'promotions'
  | 'suppliers'
  | 'customers'
  | 'users'
  | 'branches'
  | 'reports'
  | 'audit'

interface NavItem {
  label: string
  to: string
  icon: NavIconName
  subs?: { label: string; to: string }[]
  activePaths?: string[]
  inactivePaths?: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: 'dashboard',
    subs: [
      { label: 'Resumen', to: '/dashboard' },
      { label: 'BI / Analítica', to: '/reportes/dashboard' },
    ],
    activePaths: ['/reportes/dashboard'],
  },
  {
    label: 'POS',
    to: '/pos',
    icon: 'pos',
    activePaths: ['/caja/turno'],
    subs: [
      { label: 'Punto de venta', to: '/pos' },
      { label: 'Ventas', to: '/pos/ventas' },
      { label: 'Pedidos web', to: '/pos/pedidos' },
      { label: 'Caja', to: '/caja/turno' },
      { label: 'Métodos de pago', to: '/pos/metodos-pago' },
    ],
  },
  {
    label: 'Inventario',
    to: '/inventario',
    icon: 'inventory',
    subs: [
      { label: 'Existencias', to: '/inventario' },
      { label: 'Consolidado', to: '/inventario/consolidado' },
      { label: 'Movimientos', to: '/inventario/movimientos' },
      { label: 'Cierre diario', to: '/inventario/cierre' },
      { label: 'Insumos', to: '/inventario/insumos' },
    ],
  },
  {
    label: 'Catálogo',
    to: '/catalogo',
    icon: 'catalog',
    subs: [
      { label: 'Productos', to: '/catalogo' },
      { label: 'Categorías', to: '/catalogo/categorias' },
      { label: 'Unidades de medida', to: '/catalogo/unidades' },
      { label: 'Recetas', to: '/catalogo/recetas' },
    ],
  },
  {
    label: 'Promociones',
    to: '/promociones',
    icon: 'promotions',
  },
  {
    label: 'Proveedores',
    to: '/proveedores',
    icon: 'suppliers',
    subs: [
      { label: 'Proveedores', to: '/proveedores' },
      { label: 'Compras y recepción', to: '/proveedores/compras' },
      { label: 'Compras de insumos', to: '/proveedores/compras-insumos' },
    ],
  },
  {
    label: 'Clientes',
    to: '/clientes',
    icon: 'customers',
  },
  {
    label: 'Usuarios',
    to: '/usuarios',
    icon: 'users',
  },
  {
    label: 'Sedes',
    to: '/sedes',
    icon: 'branches',
  },
  {
    label: 'Reportes',
    to: '/reportes',
    icon: 'reports',
    activePaths: ['/auditoria'],
    inactivePaths: ['/reportes/dashboard'],
    subs: [
      { label: 'Reportes', to: '/reportes' },
      { label: 'Reposición sugerida', to: '/reportes/reposicion' },
      { label: 'Auditoría', to: '/auditoria' },
    ],
  },
]

const STANDALONE_AUDIT_ITEM: NavItem = {
  label: 'Auditoría',
  to: '/auditoria',
  icon: 'audit',
}

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

function isWithinPath(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function NavigationIcon({ name }: { name: NavIconName }) {
  const icons: Record<NavIconName, ReactNode> = {
    dashboard: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
        <rect x="13.5" y="3.5" width="7" height="4" rx="1" />
        <rect x="13.5" y="10.5" width="7" height="10" rx="1" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      </>
    ),
    pos: (
      <>
        <path d="M5 8h14l-1 12H6L5 8Z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
        <path d="M9 12v1m6-1v1" />
      </>
    ),
    inventory: (
      <>
        <path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z" />
        <path d="m3.8 7.7 8.2 4.4 8.2-4.4M12 12v9" />
      </>
    ),
    catalog: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
        <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" />
      </>
    ),
    promotions: (
      <>
        <path d="M20.5 13.5 13 21l-10-10V3h8l9.5 9.5a.7.7 0 0 1 0 1Z" />
        <circle cx="7.5" cy="7.5" r="1" />
      </>
    ),
    suppliers: (
      <>
        <path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" />
        <circle cx="7.5" cy="18" r="2" />
        <circle cx="17.5" cy="18" r="2" />
      </>
    ),
    customers: (
      <>
        <path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 2 18.5V20" />
        <circle cx="9" cy="7" r="4" />
        <path d="M17 11a4 4 0 0 0 0-8m5 17v-1.5a4.5 4.5 0 0 0-3.5-4.4" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20v-1.5A4.5 4.5 0 0 1 7 14h4a4.5 4.5 0 0 1 4.5 4.5V20M16 5a3.5 3.5 0 0 1 0 6.8m2 3.2a4.5 4.5 0 0 1 3.5 4.5V20" />
      </>
    ),
    branches: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    reports: (
      <>
        <path d="M4 20V10m5 10V4m5 16v-7m5 7V7" />
        <path d="M2.5 20.5h19" />
      </>
    ),
    audit: (
      <>
        <path d="M8 4h11v17H5V7l3-3Z" />
        <path d="M8 4v4H5m4 4h7m-7 4h7" />
        <path d="m3 13 2 2 3-3" />
      </>
    ),
  }

  return (
    <svg
      className="sidebar__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  )
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const { logo, isotipo } = useBrandAssets()
  const roleName = user?.role.name ?? ''
  const navItems = NAV_ITEMS.filter((item) => canAccess(item.to, roleName))

  if (canAccess('/auditoria', roleName) && !canAccess('/reportes', roleName)) {
    navItems.push(STANDALONE_AUDIT_ITEM)
  }

  return (
    <aside
      className={[
        'sidebar',
        collapsed && 'sidebar--collapsed',
        mobileOpen && 'sidebar--mobile-open',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Menú lateral"
    >
      <div className="sidebar__brand">
        <img
          className="sidebar__logo"
          src={collapsed && !mobileOpen ? isotipo : logo}
          alt="Intelligent Nutrition"
        />
        <button
          className="sidebar__collapse-toggle"
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          title={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {collapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
          </svg>
        </button>
        <button
          className="sidebar__mobile-close"
          type="button"
          onClick={onCloseMobile}
          aria-label="Cerrar menú de navegación"
          title="Cerrar menú de navegación"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <nav className="sidebar__nav" id="primary-navigation" aria-label="Navegación principal">
        {navItems.map((item) => {
          const isSectionActive =
            (isWithinPath(pathname, item.to) &&
              !item.inactivePaths?.some((path) => isWithinPath(pathname, path))) ||
            item.activePaths?.some((path) => isWithinPath(pathname, path)) === true
          return (
            <div key={item.to}>
              <NavLink
                to={item.to}
                end
                onClick={onCloseMobile}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `sidebar__link${isActive || isSectionActive ? ' sidebar__link--active' : ''}`
                }
              >
                {isSectionActive && <span className="sidebar__marker" aria-hidden="true" />}
                <NavigationIcon name={item.icon} />
                <span className="sidebar__link-label">{item.label}</span>
              </NavLink>
              {item.subs && isSectionActive && !collapsed && (
                <div className="sidebar__subs">
                  {item.subs
                    .filter((sub) => canAccess(sub.to, roleName))
                    .map((sub) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        end
                        className={({ isActive }) =>
                          `sidebar__sub${isActive ? ' sidebar__sub--active' : ''}`
                        }
                        onClick={onCloseMobile}
                      >
                        {sub.label}
                      </NavLink>
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

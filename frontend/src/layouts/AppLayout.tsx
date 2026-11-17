import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { ChatWidget } from '../components/chat/ChatWidget'
import { NotificationsPanel } from '../components/notifications/NotificationsPanel'
import { Sidebar } from '../components/Sidebar'
import { ThemeMenu } from '../components/ThemeMenu'
import { UserMenu } from '../components/UserMenu'

import './AppLayout.css'

const SIDEBAR_STORAGE_KEY = 'intelligent-nutrition:sidebar-collapsed'

interface AppLayoutProps {
  title: string
  subtitle?: string
  backTo?: string
  backLabel?: string
  actions?: ReactNode
  aside?: ReactNode
  children: ReactNode
}

function readSidebarPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function saveSidebarPreference(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
  } catch {
    return
  }
}

export function AppLayout({
  title,
  subtitle,
  backTo,
  backLabel = 'Volver',
  actions,
  aside,
  children,
}: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarPreference)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((current) => {
      const next = !current
      saveSidebarPreference(next)
      return next
    })
  }

  const closeMobileSidebar = () => setMobileSidebarOpen(false)

  useEffect(() => {
    if (!mobileSidebarOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileSidebar()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileSidebarOpen])

  useEffect(() => {
    if (!mobileSidebarOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileSidebarOpen])

  return (
    <div
      className={[
        'app-layout',
        aside && 'app-layout--with-aside',
        sidebarCollapsed && 'app-layout--sidebar-collapsed',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={closeMobileSidebar}
      />
      {mobileSidebarOpen && (
        <button
          className="app-layout__sidebar-backdrop"
          type="button"
          onClick={closeMobileSidebar}
          aria-label="Cerrar menú de navegación"
        />
      )}

      <div className="app-layout__main">
        <header className="app-layout__header">
          <button
            className="app-layout__menu-toggle"
            type="button"
            onClick={() => setMobileSidebarOpen((open) => !open)}
            aria-label={
              mobileSidebarOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'
            }
            aria-expanded={mobileSidebarOpen}
            aria-controls="primary-navigation"
            title={mobileSidebarOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {mobileSidebarOpen ? (
                <path d="m6 6 12 12M18 6 6 18" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <div className="app-layout__heading">
            {backTo && (
              <Link to={backTo} className="app-layout__back" aria-label={backLabel}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
              </Link>
            )}
            <div className="app-layout__heading-text">
              <h1 className="app-layout__title">{title}</h1>
              {subtitle && <p className="app-layout__subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="app-layout__header-actions">{actions}</div>}
          <div className="app-layout__utilities">
            <ThemeMenu />
            <NotificationsPanel />
            <UserMenu />
          </div>
        </header>

        <div className="app-layout__content">{children}</div>
      </div>

      {aside && <aside className="app-layout__aside">{aside}</aside>}
      <ChatWidget variant="internal" />
    </div>
  )
}

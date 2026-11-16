import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppLayout } from './AppLayout'

vi.mock('../components/ThemeMenu', () => ({
  ThemeMenu: () => null,
}))

vi.mock('../components/notifications/NotificationsPanel', () => ({
  NotificationsPanel: () => null,
}))

vi.mock('../components/UserMenu', () => ({
  UserMenu: () => null,
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'me', fullName: 'Persona Prueba', role: { name: 'SUPERADMIN' } },
  }),
}))

vi.mock('../hooks/useBrandAssets', () => ({
  useBrandAssets: () => ({ logo: 'logo.png', isotipo: 'isotipo.png' }),
}))

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppLayout title="Prueba">
        <p>Contenido</p>
      </AppLayout>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.removeItem('intelligent-nutrition:sidebar-collapsed')
})

describe('AppLayout sidebar controls', () => {
  it('collapses the full desktop sidebar and remembers the preference', () => {
    const { container } = renderLayout()
    const layout = container.querySelector('.app-layout')

    expect(layout).not.toHaveClass('app-layout--sidebar-collapsed')
    fireEvent.click(screen.getByRole('button', { name: 'Contraer menú lateral' }))

    expect(layout).toHaveClass('app-layout--sidebar-collapsed')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('title', 'Dashboard')
    expect(localStorage.getItem('intelligent-nutrition:sidebar-collapsed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Expandir menú lateral' }))
    expect(layout).not.toHaveClass('app-layout--sidebar-collapsed')
  })

  it('loads the collapsed preference after the layout remounts', () => {
    localStorage.setItem('intelligent-nutrition:sidebar-collapsed', 'true')
    const { container } = renderLayout()

    expect(container.querySelector('.app-layout')).toHaveClass('app-layout--sidebar-collapsed')
  })

  it('opens the full mobile drawer and closes it with Escape', () => {
    const { container } = renderLayout()
    const menuToggle = screen.getByRole('button', { name: 'Abrir menú de navegación' })
    const sidebar = container.querySelector('.sidebar')

    expect(menuToggle).toHaveAttribute('aria-expanded', 'false')
    expect(sidebar).not.toHaveClass('sidebar--mobile-open')

    fireEvent.click(menuToggle)
    expect(menuToggle).toHaveAttribute('aria-expanded', 'true')
    expect(sidebar).toHaveClass('sidebar--mobile-open')
    expect(container.querySelector('.app-layout__sidebar-backdrop')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(menuToggle).toHaveAttribute('aria-expanded', 'false')
    expect(sidebar).not.toHaveClass('sidebar--mobile-open')
  })
})

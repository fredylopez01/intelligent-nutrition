import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { SettingsPage } from './SettingsPage'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token', logout: vi.fn() }),
}))

vi.mock('../../layouts/AppLayout', () => ({
  AppLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

describe('SettingsPage', () => {
  it('opens directly on the password change, without the redundant account tab', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Seguridad'])
    expect(screen.getByRole('tab', { name: 'Seguridad' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('link', { name: 'Ir a Mi perfil' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument()
  })
})

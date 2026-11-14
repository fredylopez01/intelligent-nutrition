import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { canAccess } from './access'
import { AppRouter } from './AppRouter'

const auth = vi.hoisted(() => ({ role: 'SUPERADMIN' }))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'me', fullName: 'Yulieth Tarazona', role: { name: auth.role } },
  }),
}))

vi.mock('../layouts/AppLayout', () => ({
  AppLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

vi.mock('../pages/reports/BiDashboardPage', () => ({
  BiDashboardPage: () => <p>Informe de Looker Studio</p>,
}))

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  auth.role = 'SUPERADMIN'
  window.history.replaceState(null, '')
})

describe('route /reportes/dashboard', () => {
  it('is only allowed to the superadmin', () => {
    expect(canAccess('/reportes/dashboard', 'SUPERADMIN')).toBe(true)
    for (const role of ['BRANCH_LEADER', 'BRANCH_ASSISTANT', 'DEV', undefined]) {
      expect(canAccess('/reportes/dashboard', role)).toBe(false)
    }
  })

  it('opens the dashboard page for the superadmin', async () => {
    renderAt('/reportes/dashboard')

    expect(await screen.findByText('Informe de Looker Studio')).toBeInTheDocument()
  })

  it.each(['BRANCH_LEADER', 'BRANCH_ASSISTANT', 'DEV'])(
    'sends the %s to the page without permission',
    async (role) => {
      auth.role = role

      renderAt('/reportes/dashboard')

      expect(
        await screen.findByRole('heading', { name: 'No tienes permiso para ver esta página' }),
      ).toBeInTheDocument()
      expect(screen.queryByText('Informe de Looker Studio')).not.toBeInTheDocument()
    },
  )

  it('does not change who can open the existing report pages', () => {
    for (const path of ['/reportes', '/reportes/reposicion']) {
      expect(canAccess(path, 'SUPERADMIN')).toBe(true)
      expect(canAccess(path, 'BRANCH_LEADER')).toBe(true)
      expect(canAccess(path, 'BRANCH_ASSISTANT')).toBe(false)
    }
  })
})

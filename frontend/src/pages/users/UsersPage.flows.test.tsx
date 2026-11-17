import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUsers } from '../../hooks/useUsers'
import { useRoles } from '../../hooks/useRoles'
import type { User, UsersListParams } from '../../types/user'

import { UsersPage } from './UsersPage'

vi.mock('../../hooks/useUsers', () => ({ useUsers: vi.fn() }))
vi.mock('../../hooks/useRoles', () => ({ useRoles: vi.fn() }))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

vi.mock('../../layouts/AppLayout', () => ({
  AppLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

function buildUser(id: string, firstName: string, email: string): User {
  return {
    id,
    personId: id,
    person: { id, firstName, lastName: 'Prueba', email, phone: '3001112233', address: 'Calle 1' },
    role: { id: 'role-assistant', name: 'BRANCH_ASSISTANT' },
    branches: [],
    active: true,
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  }
}

const laura = buildUser('user-1', 'Laura', 'laura@intelligent.co')

const refetch = vi.fn()

function mockUseUsers(state: {
  status: 'loading' | 'success' | 'error'
  users?: User[]
  meta?: any
  emptyMessage?: string | null
  error?: string | null
}) {
  vi.mocked(useUsers).mockReturnValue({
    status: state.status,
    users: state.users ?? [],
    meta: state.meta ?? null,
    emptyMessage: state.emptyMessage ?? null,
    error: state.error ?? null,
    refetch,
  } as any)
}

function renderPage(path = '/usuarios') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <UsersPage />
    </MemoryRouter>,
  )
  return { user }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(useRoles).mockReturnValue({
    roles: [{ id: 'role-assistant', name: 'BRANCH_ASSISTANT', active: true }],
    isLoading: false,
  } as any)
})

describe('UsersPage create and assign flows', () => {
  it('shows the empty state calling the register action', async () => {
    mockUseUsers({
      status: 'success',
      users: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      emptyMessage: 'Registra la primera cuenta para que el equipo pueda entrar.',
    })

    renderPage()

    expect(await screen.findByText('Todavía no hay usuarios registrados')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Registrar usuario' }).length).toBeGreaterThan(0)
  })

  it('reports an error and retries after a failed load', async () => {
    mockUseUsers({ status: 'error', error: 'boom' })

    const { user } = renderPage()

    expect(await screen.findByText('boom')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(refetch).toHaveBeenCalled()
  })

  it('shows the assign-to-branch action and allows opening it', async () => {
    mockUseUsers({
      status: 'success',
      users: [laura],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })

    const { user } = renderPage()
    await screen.findByText('Laura Prueba')

    await user.click(screen.getByRole('button', { name: 'Asociar a sede' }))

    expect(screen.getByRole('dialog', { name: 'Asociar usuario a sede' })).toBeInTheDocument()
  })
})

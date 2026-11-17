import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRoles } from '../../hooks/useRoles'
import { useUsers } from '../../hooks/useUsers'
import type { User } from '../../types/user'

import { UsersPage } from './UsersPage'

vi.mock('../../hooks/useUsers', () => ({ useUsers: vi.fn() }))
vi.mock('../../hooks/useRoles', () => ({ useRoles: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ token: 't' }) }))

vi.mock('../../layouts/AppLayout', () => ({
  AppLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

vi.mock('../../components/users/CreateUserForm', () => ({
  CreateUserForm: ({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) => (
    <div>
      <button type="button" onClick={onCreated}>
        simulate created
      </button>
      <button type="button" onClick={onCancel}>
        simulate cancel
      </button>
    </div>
  ),
}))

vi.mock('../../components/users/AssignUserBranchForm', () => ({
  AssignUserBranchForm: ({ onAssigned, onClose }: { onAssigned: () => void; onClose?: () => void }) => (
    <div>
      <button type="button" onClick={onAssigned}>
        simulate assigned
      </button>
      <button type="button" onClick={onClose}>
        simulate close
      </button>
    </div>
  ),
}))

const refetch = vi.fn()

function mockUseUsers(state: {
  status: 'loading' | 'success' | 'error'
  users?: User[]
  meta?: { page: number; limit: number; total: number; totalPages: number }
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

const userFixture: User = {
  id: 'u-1',
  personId: 'u-1',
  person: {
    id: 'u-1',
    firstName: 'Ana',
    lastName: 'Perez',
    email: 'ana@now.co',
    phone: '3001234567',
    address: 'Calle 1',
  },
  role: { id: 'role-assistant', name: 'BRANCH_ASSISTANT' },
  branches: [],
  active: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-10-01',
  updatedAt: '2026-10-01',
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
    roles: [{ id: 'r1', name: 'BRANCH_LEADER', active: true }],
    isLoading: false,
  } as any)
})

describe('UsersPage role and status filters', () => {
  it('changes the role filter and passes the selected roleId to useUsers', async () => {
    mockUseUsers({
      status: 'success',
      users: [userFixture],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })

    const { user } = renderPage()
    await screen.findByText('Ana Perez')

    await user.selectOptions(screen.getByLabelText('Filtrar por rol'), 'r1')

    await waitFor(() =>
      expect(vi.mocked(useUsers).mock.calls.some((call) => call[0]?.roleId === 'r1')).toBe(true),
    )
  })

  it('changes the status filter and passes the active flag to useUsers', async () => {
    mockUseUsers({
      status: 'success',
      users: [userFixture],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })

    const { user } = renderPage()
    await screen.findByText('Ana Perez')

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'inactivos')

    await waitFor(() =>
      expect(
        vi.mocked(useUsers).mock.calls.some((call) => call[0]?.active === false),
      ).toBe(true),
    )
  })
})

describe('UsersPage create flow', () => {
  it('closes the modal, shows the banner and refetches when the user is created', async () => {
    mockUseUsers({
      status: 'success',
      users: [userFixture],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })

    const { user } = renderPage()
    await screen.findByText('Ana Perez')

    await user.click(screen.getAllByRole('button', { name: 'Registrar usuario' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Registrar usuario' })
    expect(dialog).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'simulate created' }))

    expect(await screen.findByText(/El usuario quedó registrado/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(refetch).toHaveBeenCalled()
  })

  it('closes the create modal through the child cancel path', async () => {
    mockUseUsers({
      status: 'success',
      users: [userFixture],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })

    const { user } = renderPage()
    await screen.findByText('Ana Perez')

    await user.click(screen.getAllByRole('button', { name: 'Registrar usuario' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Registrar usuario' })
    await user.click(within(dialog).getByRole('button', { name: 'simulate cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('UsersPage assign flow', () => {
  it('opens the assign modal, refreshes and closes it through the child close path', async () => {
    mockUseUsers({
      status: 'success',
      users: [userFixture],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })

    const { user } = renderPage()
    await screen.findByText('Ana Perez')

    await user.click(screen.getByRole('button', { name: 'Asociar a sede' }))
    const dialog = screen.getByRole('dialog', { name: 'Asociar usuario a sede' })
    expect(dialog).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'simulate assigned' }))

    expect(refetch).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Asociar a sede' }))
    const dialogAgain = screen.getByRole('dialog', { name: 'Asociar usuario a sede' })
    await user.click(within(dialogAgain).getByRole('button', { name: 'simulate close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

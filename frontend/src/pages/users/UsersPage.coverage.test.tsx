import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRoles } from '../../hooks/useRoles'
import { useUsers } from '../../hooks/useUsers'
import type { User, UsersListParams } from '../../types/user'

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
  AssignUserBranchForm: ({
    onAssigned,
    onClose,
  }: {
    onAssigned: () => void
    onClose?: () => void
  }) => (
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

type UsersHookState = ReturnType<typeof useUsers>

const SINGLE_PAGE_META = { page: 1, limit: 10, total: 1, totalPages: 1 }
const EMPTY_HINT =
  'Un usuario desactivado no puede ingresar, y su historial se conserva para auditoría.'

function mockUseUsers(state: Partial<UsersHookState> & Pick<UsersHookState, 'status'>) {
  vi.mocked(useUsers).mockReturnValue({
    users: [],
    meta: null,
    emptyMessage: null,
    error: null,
    refetch,
    ...state,
  })
}

function lastUsersParams(): UsersListParams {
  const call = vi.mocked(useUsers).mock.lastCall
  if (!call) throw new Error('useUsers was never called')
  return call[0]
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

function mockSuccessWithOneUser() {
  mockUseUsers({ status: 'success', users: [userFixture], meta: SINGLE_PAGE_META })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(useRoles).mockReturnValue({
    roles: [{ id: 'r1', name: 'BRANCH_LEADER', active: true }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
})

describe('UsersPage role and status filters', () => {
  it('changes the role filter and passes the selected roleId to useUsers', async () => {
    mockSuccessWithOneUser()

    const { user } = renderPage()
    await screen.findByText('Ana Perez')

    await user.selectOptions(screen.getByLabelText('Filtrar por rol'), 'r1')

    await waitFor(() => expect(lastUsersParams().roleId).toBe('r1'))
  })

  it('changes the status filter and passes the active flag to useUsers', async () => {
    mockSuccessWithOneUser()

    const { user } = renderPage()
    await screen.findByText('Ana Perez')

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'inactivos')

    await waitFor(() => expect(lastUsersParams().active).toBe(false))
  })

  it('offers the roles with their friendly label and the three status options', async () => {
    mockSuccessWithOneUser()

    renderPage()
    await screen.findByText('Ana Perez')

    const roleOptions = within(screen.getByLabelText('Filtrar por rol')).getAllByRole('option')
    const statusOptions = within(screen.getByLabelText('Filtrar por estado')).getAllByRole('option')

    expect(roleOptions.map((option) => option.textContent)).toEqual([
      'Todos los roles',
      'Líder de Sede',
    ])
    expect(statusOptions.map((option) => option.textContent)).toEqual([
      'Todos los estados',
      'Activos',
      'Inactivos',
    ])
  })

  it('stops filtering by role when the "all roles" option is selected again', async () => {
    mockSuccessWithOneUser()

    const { user } = renderPage('/usuarios?rol=r1')
    await screen.findByText('Ana Perez')
    expect(lastUsersParams().roleId).toBe('r1')

    await user.selectOptions(screen.getByLabelText('Filtrar por rol'), 'todos')

    await waitFor(() => expect(lastUsersParams().roleId).toBeUndefined())
  })
})

describe('UsersPage create flow', () => {
  it('closes the modal, shows the banner and refetches when the user is created', async () => {
    mockSuccessWithOneUser()

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

  it('goes back to the first page instead of refetching when created from a later page', async () => {
    mockUseUsers({
      status: 'success',
      users: [userFixture],
      meta: { page: 3, limit: 10, total: 30, totalPages: 3 },
    })

    const { user } = renderPage('/usuarios?pagina=3')
    await screen.findByText('Ana Perez')
    expect(lastUsersParams().page).toBe(3)

    await user.click(screen.getByRole('button', { name: 'Registrar usuario' }))
    await user.click(screen.getByRole('button', { name: 'simulate created' }))

    await waitFor(() => expect(lastUsersParams().page).toBe(1))
    expect(refetch).not.toHaveBeenCalled()
    expect(screen.getByText(/El usuario quedó registrado/)).toBeInTheDocument()
  })

  it('hides the previous success banner when the modal is opened again', async () => {
    mockSuccessWithOneUser()

    const { user } = renderPage()
    await screen.findByText('Ana Perez')

    await user.click(screen.getByRole('button', { name: 'Registrar usuario' }))
    await user.click(screen.getByRole('button', { name: 'simulate created' }))
    expect(await screen.findByText(/El usuario quedó registrado/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Registrar usuario' }))

    expect(screen.queryByText(/El usuario quedó registrado/)).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Registrar usuario' })).toBeInTheDocument()
  })

  it('closes the create modal through the child cancel path', async () => {
    mockSuccessWithOneUser()

    const { user } = renderPage()
    await screen.findByText('Ana Perez')

    await user.click(screen.getAllByRole('button', { name: 'Registrar usuario' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Registrar usuario' })
    await user.click(within(dialog).getByRole('button', { name: 'simulate cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the create modal from the empty state call to action', async () => {
    mockUseUsers({
      status: 'success',
      users: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    })

    const { user } = renderPage()
    await screen.findByText('Todavía no hay usuarios registrados')

    const [, emptyStateAction] = screen.getAllByRole('button', { name: 'Registrar usuario' })
    await user.click(emptyStateAction)

    expect(screen.getByRole('dialog', { name: 'Registrar usuario' })).toBeInTheDocument()
  })
})

describe('UsersPage assign flow', () => {
  it('opens the assign modal, refreshes and closes it through the child close path', async () => {
    mockSuccessWithOneUser()

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

describe('UsersPage modal dismissal', () => {
  it.each([
    ['Registrar usuario', 'Registrar usuario'],
    ['Asociar a sede', 'Asociar usuario a sede'],
  ])(
    'closes the "%s" modal with Escape, the close button and the backdrop',
    async (opener, title) => {
      mockSuccessWithOneUser()

      const { user } = renderPage()
      await screen.findByText('Ana Perez')

      await user.click(screen.getByRole('button', { name: opener }))
      expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: opener }))
      await user.click(screen.getByRole('button', { name: 'Cerrar diálogo' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: opener }))
      await user.click(screen.getByRole('button', { name: 'Cerrar' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    },
  )
})

describe('UsersPage list states', () => {
  it('shows the loading skeleton instead of the table while the list loads', () => {
    mockUseUsers({ status: 'loading' })

    renderPage()

    expect(screen.getByText('Cargando usuarios...')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the backend message in the empty state when there is one', () => {
    mockUseUsers({
      status: 'success',
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      emptyMessage: 'Aún no hay usuarios en esta sede.',
    })

    renderPage()

    expect(screen.getByText('Aún no hay usuarios en esta sede.')).toBeInTheDocument()
  })

  it('falls back to the default empty-state description without a backend message', () => {
    mockUseUsers({ status: 'success', meta: { page: 1, limit: 10, total: 0, totalPages: 0 } })

    renderPage()

    expect(
      screen.getByText('Registra la primera cuenta para que el equipo pueda entrar.'),
    ).toBeInTheDocument()
  })

  it('links every row to its detail keeping the current filters as the return path', async () => {
    mockUseUsers({
      status: 'success',
      users: [userFixture],
      meta: { page: 2, limit: 10, total: 11, totalPages: 2 },
    })

    function DetailProbe() {
      const location = useLocation()
      const from = (location.state as { from?: string } | null)?.from ?? ''
      return <p>{`Detail ${location.pathname} from ${from}`}</p>
    }

    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/usuarios?estado=activos&pagina=2']}>
        <Routes>
          <Route path="/usuarios" element={<UsersPage />} />
          <Route path="/usuarios/:id" element={<DetailProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('link', { name: 'Ver detalle de Ana Perez' }))

    expect(
      await screen.findByText('Detail /usuarios/u-1 from /usuarios?estado=activos&pagina=2'),
    ).toBeInTheDocument()
  })
})

describe('UsersPage footer hint', () => {
  it.each([
    [1, '1 usuario. Abre uno para ver y editar sus datos, rol y sedes.'],
    [25, '25 usuarios. Abre uno para ver y editar sus datos, rol y sedes.'],
  ])('summarizes %i user(s) with the right plural', (total, hint) => {
    mockUseUsers({
      status: 'success',
      users: [userFixture],
      meta: { page: 1, limit: 50, total, totalPages: 1 },
    })

    renderPage()

    expect(screen.getByText(hint)).toBeInTheDocument()
  })

  it.each([
    [
      'there are no users',
      { status: 'success' as const, meta: { page: 1, limit: 10, total: 0, totalPages: 0 } },
    ],
    ['the response has no pagination meta', { status: 'success' as const, users: [userFixture] }],
    ['the list is loading', { status: 'loading' as const }],
    ['the list failed', { status: 'error' as const, error: 'boom' }],
  ])('keeps the generic hint when %s', (_case, state) => {
    mockUseUsers(state)

    renderPage()

    expect(screen.getByText(EMPTY_HINT)).toBeInTheDocument()
  })
})

describe('UsersPage pagination', () => {
  it('resets to the first page when the page size changes', async () => {
    mockUseUsers({
      status: 'success',
      users: [userFixture],
      meta: { page: 2, limit: 10, total: 60, totalPages: 6 },
    })

    const { user } = renderPage('/usuarios?pagina=2')
    await screen.findByText('Ana Perez')
    expect(lastUsersParams()).toMatchObject({ page: 2, limit: 10 })

    await user.selectOptions(screen.getByLabelText('Filas por página'), '50')

    await waitFor(() => expect(lastUsersParams()).toMatchObject({ page: 1, limit: 50 }))
  })

  it.each([
    ['loading', { status: 'loading' as const }],
    ['error', { status: 'error' as const, error: 'boom' }],
  ])('does not render the pagination while the list is in %s state', (_case, state) => {
    mockUseUsers(state)

    renderPage()

    expect(
      screen.queryByRole('navigation', { name: 'Paginación de usuarios' }),
    ).not.toBeInTheDocument()
  })
})

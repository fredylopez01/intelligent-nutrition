import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUser } from '../../hooks/useUser'
import { ApiError } from '../../services/http'
import { usersService } from '../../services/users.service'
import type { User } from '../../types/user'

import { UserDetailPage } from './UserDetailPage'

vi.mock('../../hooks/useUser', () => ({ useUser: vi.fn() }))

vi.mock('../../services/users.service', () => ({
  usersService: { updateStatus: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'admin-1', fullName: 'Admin', email: 'admin@test.com' },
  }),
}))

vi.mock('../../layouts/AppLayout', () => ({
  AppLayout: ({
    title,
    subtitle,
    children,
    actions,
  }: {
    title: string
    subtitle?: string
    children: ReactNode
    actions?: ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions}
      {children}
    </main>
  ),
}))

const refetch = vi.fn()
const useUserMock = vi.mocked(useUser)

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    personId: 'p-1',
    person: {
      id: 'p-1',
      firstName: 'Laura',
      lastName: 'Perez',
      email: 'laura@intelligent.co',
      phone: '3001234567',
      address: 'Calle 93 # 15-20',
    },
    role: { id: 'role-1', name: 'BRANCH_LEADER' },
    branches: [{ id: 'branch-1', name: 'Sede Makro' }],
    active: true,
    mustChangePassword: false,
    lastLoginAt: '2026-09-14T14:20:00.000Z',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  }
}

function setHookState(state: {
  status: 'loading' | 'success' | 'not-found' | 'error'
  user?: User | null
  error?: string | null
}) {
  useUserMock.mockReturnValue({
    status: state.status,
    user: state.user ?? null,
    error: state.error ?? null,
    isRefreshing: false,
    refetch,
  } as unknown as ReturnType<typeof useUser>)
}

function renderPage(path = '/usuarios/u-1?tab=datos') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/usuarios/:userId" element={<UserDetailPage />} />
        <Route path="/usuarios" element={<p>listado</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return { user }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('UserDetailPage', () => {
  it('shows the loading skeleton', () => {
    setHookState({ status: 'loading', user: null })

    const { container } = render(
      <MemoryRouter initialEntries={['/usuarios/u-1']}>
        <Routes>
          <Route path="/usuarios/:userId" element={<UserDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(within(container).queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('shows the not-found state', () => {
    setHookState({ status: 'not-found', user: null })

    renderPage()

    expect(screen.getByText('Este usuario no existe')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al listado' })).toBeInTheDocument()
  })

  it('shows the error state with a retry action', async () => {
    setHookState({ status: 'error', user: null, error: 'boom' })

    const { user } = renderPage('/usuarios/u-1?tab=datos')

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(screen.getByText('boom')).toBeInTheDocument()
    await user.click(retry)
    expect(refetch).toHaveBeenCalled()
  })

  it('renders the profile and the tabs for a loaded user', () => {
    setHookState({ status: 'success', user: buildUser() })

    renderPage('/usuarios/u-1?tab=datos')

    expect(screen.getByRole('heading', { name: 'Laura Perez', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('laura@intelligent.co')).toBeInTheDocument()
    expect(screen.getByText('Sede Makro')).toBeInTheDocument()
    expect(screen.getByText('Líder de Sede')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Datos personales' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('switches tabs using the query string', async () => {
    setHookState({ status: 'success', user: buildUser() })

    const { user } = renderPage('/usuarios/u-1?tab=datos')

    await user.click(screen.getByRole('tab', { name: 'Rol y acceso' }))

    expect(screen.getByRole('tab', { name: 'Rol y acceso' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('falls back to the personal data tab when the query is unknown', () => {
    setHookState({ status: 'success', user: buildUser() })

    renderPage('/usuarios/u-1?tab=inyeccion')

    expect(screen.getByRole('tab', { name: 'Datos personales' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('reactivates an inactive account through the confirmation modal', async () => {
    const target = buildUser({ active: false })
    setHookState({ status: 'success', user: target })
    vi.mocked(usersService.updateStatus).mockResolvedValue({
      message: 'User status updated successfully.',
    })

    const { user } = renderPage('/usuarios/u-1?tab=datos')

    await user.click(screen.getByRole('button', { name: 'Reactivar usuario' }))
    expect(screen.getByText('¿Reactivar esta cuenta?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sí, reactivar' }))

    await waitFor(() =>
      expect(usersService.updateStatus).toHaveBeenCalledWith(
        'u-1',
        { active: true },
        'test-token',
      ),
    )
    expect(screen.getByText(/fue reactivado/)).toBeInTheDocument()
    expect(refetch).toHaveBeenCalled()
  })

  it('deactivates an active account and reports success', async () => {
    const target = buildUser({ active: true })
    setHookState({ status: 'success', user: target })
    vi.mocked(usersService.updateStatus).mockResolvedValue({
      message: 'User status updated successfully.',
    })

    const { user } = renderPage('/usuarios/u-1?tab=datos')

    await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }))
    await user.click(screen.getByRole('button', { name: 'Sí, desactivar' }))

    await waitFor(() =>
      expect(usersService.updateStatus).toHaveBeenCalledWith(
        'u-1',
        { active: false },
        'test-token',
      ),
    )
    expect(screen.getByText(/Laura Perez fue desactivado/)).toBeInTheDocument()
  })

  it('shows the permission error when the server rejects the status change', async () => {
    const target = buildUser({ active: true })
    setHookState({ status: 'success', user: target })
    vi.mocked(usersService.updateStatus).mockRejectedValue(new ApiError('forbidden', 403))

    const { user } = renderPage('/usuarios/u-1?tab=datos')

    await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }))
    await user.click(screen.getByRole('button', { name: 'Sí, desactivar' }))

    await waitFor(() =>
      expect(
        screen.getByText('No tienes permiso para cambiar el estado de esta cuenta.'),
      ).toBeInTheDocument(),
    )
    expect(refetch).not.toHaveBeenCalled()
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '../../hooks/useAuth'
import { useRoles } from '../../hooks/useRoles'
import { ApiError } from '../../services/http'
import { usersService } from '../../services/users.service'
import type { User } from '../../types/user'

import { UserAccessPanel } from './UserAccessPanel'

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../../hooks/useRoles', () => ({ useRoles: vi.fn() }))
vi.mock('../../services/users.service', () => ({
  usersService: { updateRole: vi.fn(), resendInvitation: vi.fn() },
}))

const roles = [
  { id: 'role-superadmin', name: 'SUPERADMIN', active: true },
  { id: 'role-leader', name: 'BRANCH_LEADER', active: true },
  { id: 'role-legacy', name: 'BRANCH_ASSISTANT', active: false },
]

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    personId: 'p-1',
    person: {
      id: 'p-1',
      firstName: 'Ana',
      lastName: 'Perez',
      email: 'ana@test.com',
      phone: null,
      address: null,
    },
    role: { id: 'role-leader', name: 'BRANCH_LEADER' },
    branches: [],
    active: true,
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const onSaved = vi.fn()

function renderPanel(user: User = buildUser()) {
  return render(<UserAccessPanel user={user} onSaved={onSaved} />)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    token: 'token',
    user: { id: 'admin-1', fullName: 'Admin', email: 'admin@test.com' },
  } as unknown as ReturnType<typeof useAuth>)
  vi.mocked(useRoles).mockReturnValue({
    roles,
    isLoading: false,
  } as unknown as ReturnType<typeof useRoles>)
})

describe('UserAccessPanel', () => {
  it('lists the roles and marks the current one', () => {
    renderPanel()

    expect(screen.getByText('Superadmin')).toBeInTheDocument()
    expect(screen.getByText('Actual')).toBeInTheDocument()
    expect(screen.queryByText('Ayudante de Sede')).not.toBeInTheDocument()
  })

  it('saves the selected role and reports success', async () => {
    const user = userEvent.setup()
    vi.mocked(usersService.updateRole).mockResolvedValue(buildUser())

    renderPanel()
    await user.click(screen.getAllByRole('radio')[0])
    await user.click(screen.getByRole('button', { name: 'Guardar rol' }))

    await waitFor(() =>
      expect(screen.getByText('El rol se actualizó correctamente.')).toBeInTheDocument(),
    )
    expect(usersService.updateRole).toHaveBeenCalledWith(
      'u-1',
      { roleId: 'role-superadmin' },
      'token',
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('discards the pending role change', async () => {
    const user = userEvent.setup()

    renderPanel()
    await user.click(screen.getAllByRole('radio')[0])
    await user.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument()
    expect(usersService.updateRole).not.toHaveBeenCalled()
  })

  it('blocks changing your own role', () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'token',
      user: { id: 'u-1', fullName: 'Ana', email: 'ana@test.com' },
    } as unknown as ReturnType<typeof useAuth>)

    renderPanel()

    expect(screen.getByText('Esta es tu cuenta: no puedes cambiar tu propio rol.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar rol' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')[0]).toBeDisabled()
  })

  it('explains a forbidden role change', async () => {
    const user = userEvent.setup()
    vi.mocked(usersService.updateRole).mockRejectedValue(new ApiError('forbidden', 403))

    renderPanel()
    await user.click(screen.getAllByRole('radio')[0])
    await user.click(screen.getByRole('button', { name: 'Guardar rol' }))

    await waitFor(() =>
      expect(
        screen.getByText('No tienes permiso para cambiar esta cuenta.'),
      ).toBeInTheDocument(),
    )
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('explains a missing user or role', async () => {
    const user = userEvent.setup()
    vi.mocked(usersService.updateRole).mockRejectedValue(new ApiError('missing', 404))

    renderPanel()
    await user.click(screen.getAllByRole('radio')[0])
    await user.click(screen.getByRole('button', { name: 'Guardar rol' }))

    await waitFor(() =>
      expect(
        screen.getByText('El usuario o el rol ya no existe. Vuelve al listado.'),
      ).toBeInTheDocument(),
    )
  })

  it('falls back to a generic message for an unknown failure', async () => {
    const user = userEvent.setup()
    vi.mocked(usersService.updateRole).mockRejectedValue(new ApiError('boom', 500))

    renderPanel()
    await user.click(screen.getAllByRole('radio')[0])
    await user.click(screen.getByRole('button', { name: 'Guardar rol' }))

    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument())
  })

  it('shows the activation hint for a pending account', () => {
    renderPanel(buildUser({ mustChangePassword: true }))

    expect(screen.getByText(/La cuenta todavía no se activa/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reenviar correo de activación' })).toBeInTheDocument()
  })

  it('describes an active account with its last login', () => {
    renderPanel(buildUser({ lastLoginAt: '2026-09-14T14:20:00.000Z' }))

    expect(screen.getByText(/La cuenta está activa/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Reenviar correo de activación' }),
    ).not.toBeInTheDocument()
  })

  it('describes an inactive account', () => {
    renderPanel(buildUser({ active: false }))

    expect(screen.getByText(/La cuenta está desactivada/)).toBeInTheDocument()
  })

  it('resends the activation email', async () => {
    const user = userEvent.setup()
    vi.mocked(usersService.resendInvitation).mockResolvedValue({
      message: 'Activation email sent successfully',
    })

    renderPanel(buildUser({ mustChangePassword: true }))
    await user.click(screen.getByRole('button', { name: 'Reenviar correo de activación' }))

    await waitFor(() =>
      expect(
        screen.getByText('Se reenvió el correo de activación a ana@test.com.'),
      ).toBeInTheDocument(),
    )
    expect(usersService.resendInvitation).toHaveBeenCalledWith('ana@test.com', 'token')
  })

  it('reports a failed resend', async () => {
    const user = userEvent.setup()
    vi.mocked(usersService.resendInvitation).mockRejectedValue(new ApiError('rocket', 500))

    renderPanel(buildUser({ mustChangePassword: true }))
    await user.click(screen.getByRole('button', { name: 'Reenviar correo de activación' }))

    await waitFor(() => expect(screen.getByText('rocket')).toBeInTheDocument())
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { usersService } from '../../services/users.service'
import type { User } from '../../types/user'

import { UserPersonalDataForm } from './UserPersonalDataForm'

vi.mock('../../services/users.service', () => ({
  usersService: { update: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

const updateUser = vi.mocked(usersService.update)

const baseUser: User = {
  id: 'user-1',
  personId: 'user-1',
  person: {
    id: 'user-1',
    firstName: 'Yulieth',
    lastName: 'Tarazona',
    email: 'yulieth@intelligent.co',
    phone: '3001234567',
    address: 'Calle 10 # 20-30',
  },
  role: { id: 'role-assistant', name: 'BRANCH_ASSISTANT' },
  branches: [],
  active: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
}

function renderForm(user: User = baseUser) {
  const onSaved = vi.fn()
  const testUser = userEvent.setup()
  render(<UserPersonalDataForm user={user} onSaved={onSaved} />)
  return { user: testUser, onSaved }
}

beforeEach(() => {
  vi.resetAllMocks()
  updateUser.mockResolvedValue(baseUser)
})

describe('UserPersonalDataForm submit paths', () => {
  it('shows a conflict message when the email is already registered', async () => {
    updateUser.mockRejectedValue(new ApiError('email taken', 409))

    const { user } = renderForm()

    await user.clear(screen.getByLabelText('Correo electrónico'))
    await user.type(screen.getByLabelText('Correo electrónico'), 'otro@intelligent.co')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(
      await screen.findByText('Ese correo ya está registrado en otra cuenta.'),
    ).toBeInTheDocument()
  })

  it('shows a not-found message when the user was deleted', async () => {
    updateUser.mockRejectedValue(new ApiError('missing', 404))

    const { user } = renderForm()

    await user.clear(screen.getByLabelText('Nombres'))
    await user.type(screen.getByLabelText('Nombres'), 'Maria')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(
      await screen.findByText('El usuario ya no existe. Vuelve al listado.'),
    ).toBeInTheDocument()
  })

  it('shows the permission message when the user is not allowed', async () => {
    updateUser.mockRejectedValue(new ApiError('forbidden', 403))

    const { user } = renderForm()

    await user.clear(screen.getByLabelText('Nombres'))
    await user.type(screen.getByLabelText('Nombres'), 'Maria')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(
      await screen.findByText('No tienes permiso para actualizar esta cuenta.'),
    ).toBeInTheDocument()
  })

  it('shows an error state when a save reports no changes', async () => {
    const { user } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('No hay cambios por guardar.')).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('reports success when only the address changes', async () => {
    const { user, onSaved } = renderForm()

    await user.clear(screen.getByLabelText('Dirección'))
    await user.type(screen.getByLabelText('Dirección'), 'Carrera 9 # 8-7')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Los datos se guardaron correctamente.')).toBeInTheDocument()
    expect(updateUser).toHaveBeenCalledWith(
      'user-1',
      { person: { address: 'Carrera 9 # 8-7' } },
      'test-token',
    )
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('normalizes the email before saving', async () => {
    const { user } = renderForm()

    await user.clear(screen.getByLabelText('Correo electrónico'))
    await user.type(screen.getByLabelText('Correo electrónico'), '  OTRA@intelligent.CO  ')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith(
        'user-1',
        { person: { email: 'otra@intelligent.co' } },
        'test-token',
      ),
    )
  })
})

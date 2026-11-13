import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { profileService } from '../../services/profile.service'
import type { OwnProfile } from '../../types/profile'

import { ProfilePage } from './ProfilePage'

const session = vi.hoisted(() => ({ updateSessionUser: vi.fn() }))

vi.mock('../../services/profile.service', () => ({
  profileService: { get: vi.fn(), update: vi.fn() },
}))

vi.mock('../../services/auth.service', () => ({
  authService: { changePassword: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'me', fullName: 'Laura Restrepo', role: { name: 'BRANCH_LEADER' } },
    logout: vi.fn(),
    updateSessionUser: session.updateSessionUser,
  }),
}))

vi.mock('../../layouts/AppLayout', () => ({
  AppLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

const getProfile = vi.mocked(profileService.get)
const updateProfile = vi.mocked(profileService.update)

function buildProfile(overrides: Partial<OwnProfile['person']> = {}): OwnProfile {
  return {
    id: 'me',
    email: 'laura.restrepo@example.com',
    role: { id: 'role-bl', name: 'BRANCH_LEADER' },
    person: {
      id: 'me',
      documentNumber: '1039456781',
      firstName: 'Laura',
      lastName: 'Restrepo',
      businessName: null,
      email: 'laura.restrepo@example.com',
      phone: '3004567812',
      address: 'Carrera 43A # 1-50',
      profilePhotoUrl: null,
      documentType: { code: 'CC', name: 'Cédula de Ciudadanía' },
      ...overrides,
    },
    branches: [{ id: 'branch-medellin', name: 'Medellín' }],
    createdAt: '2026-10-26T05:00:02.432Z',
    updatedAt: '2026-11-12T22:24:15.806Z',
  }
}

function renderPage() {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  )
  return { user }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('ProfilePage', () => {
  it('loads the current data of the user', async () => {
    getProfile.mockResolvedValue(buildProfile())
    renderPage()

    expect(await screen.findByLabelText('Nombres')).toHaveValue('Laura')
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Restrepo')
    expect(screen.getByLabelText('Correo')).toHaveValue('laura.restrepo@example.com')
    expect(screen.getByLabelText('Correo')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Documento')).toHaveValue('CC 1039456781')
    expect(screen.getByLabelText('Teléfono')).toHaveValue('3004567812')
    expect(screen.getByLabelText('Dirección')).toHaveValue('Carrera 43A # 1-50')
    expect(screen.getByText('Laura Restrepo')).toBeInTheDocument()
    expect(screen.getByText('Líder de Sede')).toBeInTheDocument()
    expect(screen.getByText('Medellín')).toBeInTheDocument()
  })

  it('shows the password section next to the personal data', async () => {
    getProfile.mockResolvedValue(buildProfile())
    renderPage()

    await screen.findByLabelText('Nombres')
    expect(screen.getByRole('heading', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toBeInTheDocument()
  })

  it('validates that the new password and its confirmation match before sending', async () => {
    getProfile.mockResolvedValue(buildProfile())
    const { user } = renderPage()

    await user.type(await screen.findByLabelText('Contraseña actual'), 'Actual#2026')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva#2026x')
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Otra#2026x')
    const passwordForm = screen
      .getByRole('heading', { name: 'Cambiar contraseña' })
      .closest('section') as HTMLElement
    await user.click(
      Array.from(passwordForm.querySelectorAll('button[type="submit"]'))[0] as HTMLElement,
    )

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument()
  })

  it('sends only the changed fields and updates the session name', async () => {
    getProfile.mockResolvedValue(buildProfile())
    updateProfile.mockResolvedValue(
      buildProfile({ firstName: 'Laura Marcela', phone: '3101112233' }),
    )
    const { user } = renderPage()

    const firstName = await screen.findByLabelText('Nombres')
    await user.clear(firstName)
    await user.type(firstName, '  Laura Marcela ')
    await user.clear(screen.getByLabelText('Teléfono'))
    await user.type(screen.getByLabelText('Teléfono'), '3101112233')
    await user.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        { firstName: 'Laura Marcela', phone: '3101112233' },
        'test-token',
      ),
    )
    expect(await screen.findByText('Tus datos se actualizaron.')).toBeInTheDocument()
    expect(session.updateSessionUser).toHaveBeenCalledWith({ fullName: 'Laura Marcela Restrepo' })
    expect(screen.getByText('Laura Marcela Restrepo')).toBeInTheDocument()
  })

  it('keeps the save button disabled until something changes', async () => {
    getProfile.mockResolvedValue(buildProfile())
    renderPage()

    await screen.findByLabelText('Nombres')
    expect(screen.getAllByRole('button', { name: 'Guardar cambios' })[0]).toBeDisabled()
  })

  it('does not let the user clear a saved value nor type letters in the phone', async () => {
    getProfile.mockResolvedValue(buildProfile())
    const { user } = renderPage()

    await user.clear(await screen.findByLabelText('Dirección'))
    const phone = screen.getByLabelText('Teléfono')
    await user.clear(phone)
    await user.type(phone, '300-123')
    await user.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])

    expect(
      await screen.findByText('La dirección no puede quedar vacía. Escribe la nueva dirección.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Escribe solo números, sin espacios ni guiones.')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('lets the user fill a phone that was empty and leave it empty', async () => {
    getProfile.mockResolvedValue(buildProfile({ phone: null }))
    updateProfile.mockResolvedValue(buildProfile({ phone: null, address: 'Calle 10' }))
    const { user } = renderPage()

    const address = await screen.findByLabelText('Dirección')
    await user.clear(address)
    await user.type(address, 'Calle 10')
    await user.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({ address: 'Calle 10' }, 'test-token'),
    )
  })

  it('shows the error of the server when saving fails', async () => {
    getProfile.mockResolvedValue(buildProfile())
    updateProfile.mockRejectedValue(new ApiError('Bad request', 400))
    const { user } = renderPage()

    const lastName = await screen.findByLabelText('Apellidos')
    await user.type(lastName, ' Gómez')
    await user.click(screen.getAllByRole('button', { name: 'Guardar cambios' })[0])

    expect(
      await screen.findByText('Revisa los datos: hay un valor que el servidor no aceptó.'),
    ).toBeInTheDocument()
  })

  it('shows a loading state and then the error with a retry', async () => {
    getProfile.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(buildProfile())
    const { user } = renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando tu perfil...')
    expect(
      await screen.findByText('No fue posible cargar tu perfil. Intenta de nuevo.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByLabelText('Nombres')).toHaveValue('Laura')
  })
})

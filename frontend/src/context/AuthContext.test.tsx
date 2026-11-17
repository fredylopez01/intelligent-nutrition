import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '../hooks/useAuth'
import { authService } from '../services/auth.service'
import { setUnauthorizedHandler } from '../services/http'
import type { SessionUser } from '../types/auth'

import { AuthProvider } from './AuthContext'

vi.mock('../services/auth.service', () => ({
  authService: { login: vi.fn(), me: vi.fn() },
}))

vi.mock('../services/http', () => ({
  setUnauthorizedHandler: vi.fn(),
}))

const STORAGE_KEY = 'intelligent-nutrition:session'

const sessionUser: SessionUser = {
  id: 'person-1',
  fullName: 'Ana Perez',
  email: 'ana@test.com',
  roleId: 'role-1',
  active: true,
  role: { id: 'role-1', name: 'BRANCH_LEADER' },
}

function Probe() {
  const auth = useAuth()

  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="user">{auth.user?.fullName ?? '-'}</span>
      <span data-testid="error">{auth.error ?? '-'}</span>
      <button
        onClick={() => void auth.login({ email: 'ana@test.com', password: 'x' }).catch(() => {})}
      >
        login
      </button>
      <button onClick={() => void auth.loginWithToken('google-token').catch(() => {})}>
        token
      </button>
      <button onClick={() => auth.logout()}>logout</button>
      <button onClick={() => auth.updateSessionUser({ fullName: 'Ana Actualizada' })}>
        rename
      </button>
    </div>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

function storeSession(token: string, user: SessionUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }))
}

beforeEach(() => {
  vi.resetAllMocks()
  // Pin the flag so a local .env with VITE_MOCK_SESSION=true cannot change what is under test.
  vi.stubEnv('VITE_MOCK_SESSION', 'false')
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('AuthProvider', () => {
  it('starts idle when there is no stored session', () => {
    renderProvider()

    expect(screen.getByTestId('status')).toHaveTextContent('idle')
    expect(screen.getByTestId('user')).toHaveTextContent('-')
    expect(screen.getByTestId('error')).toHaveTextContent('-')
  })

  it('restores a stored session as authenticated', () => {
    storeSession('stored-token', sessionUser)

    renderProvider()

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('user')).toHaveTextContent('Ana Perez')
  })

  it('ignores a corrupted stored session', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json')

    renderProvider()

    expect(screen.getByTestId('status')).toHaveTextContent('idle')
    expect(screen.getByTestId('user')).toHaveTextContent('-')
  })

  it('logs in, stores the session and exposes the user', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.login).mockResolvedValue({ accessToken: 'jwt', expiresIn: '15m' })
    vi.mocked(authService.me).mockResolvedValue(sessionUser)

    renderProvider()
    await user.click(screen.getByRole('button', { name: 'login' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('user')).toHaveTextContent('Ana Perez')
    expect(authService.login).toHaveBeenCalledWith({ email: 'ana@test.com', password: 'x' })
    expect(authService.me).toHaveBeenCalledWith('jwt')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({
      token: 'jwt',
      user: sessionUser,
    })
  })

  it('signs in with the development mock session without calling the API', async () => {
    vi.stubEnv('VITE_MOCK_SESSION', 'true')
    const user = userEvent.setup()

    renderProvider()
    await user.click(screen.getByRole('button', { name: 'login' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'), {
      timeout: 3000,
    })
    expect(screen.getByTestId('user')).toHaveTextContent('Natalia Bernal')
    expect(authService.login).not.toHaveBeenCalled()
    expect(authService.me).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toMatchObject({
      token: 'dev-mock-token',
    })
  })

  it('reports the error when the credentials are rejected', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.login).mockRejectedValue(new Error('Credenciales inválidas'))

    renderProvider()
    await user.click(screen.getByRole('button', { name: 'login' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
    expect(screen.getByTestId('error')).toHaveTextContent('Credenciales inválidas')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('falls back to a generic message for a non Error rejection', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.login).mockRejectedValue('boom')

    renderProvider()
    await user.click(screen.getByRole('button', { name: 'login' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
    expect(screen.getByTestId('error')).toHaveTextContent(
      'No fue posible iniciar sesión. Intenta de nuevo.',
    )
  })

  it('signs in with a token coming from the Google callback', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.me).mockResolvedValue(sessionUser)

    renderProvider()
    await user.click(screen.getByRole('button', { name: 'token' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(authService.me).toHaveBeenCalledWith('google-token')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({
      token: 'google-token',
      user: sessionUser,
    })
  })

  it('reports the error when the token is rejected', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.me).mockRejectedValue(new Error('Sesión inválida'))

    renderProvider()
    await user.click(screen.getByRole('button', { name: 'token' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
    expect(screen.getByTestId('error')).toHaveTextContent('Sesión inválida')
  })

  it('logs out and clears the stored session', async () => {
    const user = userEvent.setup()
    storeSession('stored-token', sessionUser)

    renderProvider()
    await user.click(screen.getByRole('button', { name: 'logout' }))

    expect(screen.getByTestId('status')).toHaveTextContent('idle')
    expect(screen.getByTestId('user')).toHaveTextContent('-')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('updates the session user and rewrites the stored session', async () => {
    const user = userEvent.setup()
    storeSession('stored-token', sessionUser)

    renderProvider()
    await user.click(screen.getByRole('button', { name: 'rename' }))

    expect(screen.getByTestId('user')).toHaveTextContent('Ana Actualizada')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({
      token: 'stored-token',
      user: { ...sessionUser, fullName: 'Ana Actualizada' },
    })
  })

  it('does not invent a user when it updates the session without one', async () => {
    const user = userEvent.setup()

    renderProvider()
    await user.click(screen.getByRole('button', { name: 'rename' }))

    expect(screen.getByTestId('user')).toHaveTextContent('-')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('logs out through the unauthorized handler registered for http', () => {
    storeSession('stored-token', sessionUser)

    renderProvider()

    const handler = vi.mocked(setUnauthorizedHandler).mock.calls[0]?.[0]
    expect(typeof handler).toBe('function')

    act(() => handler?.())

    expect(screen.getByTestId('status')).toHaveTextContent('idle')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('useAuth', () => {
  it('throws when it is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow('useAuth debe usarse dentro de <AuthProvider>')

    spy.mockRestore()
  })
})

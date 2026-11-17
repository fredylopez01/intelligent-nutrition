import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authService } from './auth.service'
import { API_BASE_URL, http } from './http'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

const get = vi.mocked(http.get)
const post = vi.mocked(http.post)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('authService', () => {
  it('builds the Google login URL from the API base', () => {
    expect(authService.googleLoginUrl()).toBe(`${API_BASE_URL}/auth/google`)
  })

  it('posts the credentials to log in', async () => {
    const response = { accessToken: 'token', tokenType: 'Bearer' }
    post.mockResolvedValue(response)

    await expect(authService.login({ email: 'ana@test.com', password: 'secret' })).resolves.toEqual(
      response,
    )
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'ana@test.com', password: 'secret' })
  })

  it('reads the current session with the bearer token', async () => {
    const user = { id: 'user-1', fullName: 'Ana Perez', email: 'ana@test.com' }
    get.mockResolvedValue(user)

    await expect(authService.me('token')).resolves.toEqual(user)
    expect(get).toHaveBeenCalledWith('/auth/me', { token: 'token' })
  })

  it('activates an account without triggering the session handler', async () => {
    post.mockResolvedValue({ message: 'Account activated successfully.' })

    await authService.activate({ token: 'raw-token', password: 'StrongPass123!' })

    expect(post).toHaveBeenCalledWith(
      '/auth/activate',
      { token: 'raw-token', password: 'StrongPass123!' },
      { skipUnauthorizedHandler: true },
    )
  })

  it('requests a password reset link', async () => {
    post.mockResolvedValue({ message: 'ok' })

    await authService.forgotPassword({ email: 'ana@test.com' })

    expect(post).toHaveBeenCalledWith(
      '/auth/forgot-password',
      { email: 'ana@test.com' },
      { skipUnauthorizedHandler: true },
    )
  })

  it('sets a new password with the reset token', async () => {
    post.mockResolvedValue({ message: 'ok' })

    await authService.resetPassword({ token: 'reset-token', password: 'NewPass123!' })

    expect(post).toHaveBeenCalledWith(
      '/auth/reset-password',
      { token: 'reset-token', password: 'NewPass123!' },
      { skipUnauthorizedHandler: true },
    )
  })

  it('changes the password with the session token and skips the 401 handler', async () => {
    post.mockResolvedValue({ message: 'Password changed successfully.' })

    await authService.changePassword(
      { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' },
      'token',
    )

    expect(post).toHaveBeenCalledWith(
      '/auth/change-password',
      { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' },
      { token: 'token', skipUnauthorizedHandler: true },
    )
  })
})

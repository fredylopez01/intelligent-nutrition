import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from './http'
import { profileService } from './profile.service'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn(), patch: vi.fn() } }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('profileService', () => {
  it('reads the own profile', async () => {
    vi.mocked(http.get).mockResolvedValue({})

    await profileService.get('token')

    expect(http.get).toHaveBeenCalledWith('/users/me', { token: 'token' })
  })

  it('updates only the fields sent', async () => {
    vi.mocked(http.patch).mockResolvedValue({})

    await profileService.update({ phone: '3001112233' }, 'token')

    expect(http.patch).toHaveBeenCalledWith(
      '/users/me',
      { phone: '3001112233' },
      { token: 'token' },
    )
  })
})

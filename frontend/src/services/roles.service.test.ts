import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from './http'
import { MOCK_ROLES } from './mocks/users.mock'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

const get = vi.mocked(http.get)

async function loadService(useMocks: boolean) {
  vi.stubEnv('VITE_USE_MOCKS', String(useMocks))
  vi.resetModules()
  const module = await import('./roles.service')
  return module.rolesService
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('rolesService', () => {
  it('lists the roles from the API when the mocks are off', async () => {
    const rolesService = await loadService(false)
    get.mockResolvedValue([{ id: 'role-1', name: 'SUPERADMIN' }])

    await expect(rolesService.list('token')).resolves.toEqual([
      { id: 'role-1', name: 'SUPERADMIN' },
    ])
    expect(get).toHaveBeenCalledWith('/roles', { token: 'token' })
  })

  it('returns the mocked roles without calling the API when the mocks are on', async () => {
    const rolesService = await loadService(true)

    await expect(rolesService.list(null)).resolves.toEqual(MOCK_ROLES)
    expect(get).not.toHaveBeenCalled()
  })
})

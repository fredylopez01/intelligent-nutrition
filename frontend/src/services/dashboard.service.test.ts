import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dashboardService } from './dashboard.service'
import { http } from './http'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn() } }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('dashboardService', () => {
  it('requests the dashboard of a branch', async () => {
    vi.mocked(http.get).mockResolvedValue({})

    await dashboardService.branch('branch-1', 'token')

    expect(http.get).toHaveBeenCalledWith('/dashboard/branch/branch-1', { token: 'token' })
  })

  it('requests the global dashboard', async () => {
    vi.mocked(http.get).mockResolvedValue({})

    await dashboardService.global('token')

    expect(http.get).toHaveBeenCalledWith('/dashboard/global', { token: 'token' })
  })
})

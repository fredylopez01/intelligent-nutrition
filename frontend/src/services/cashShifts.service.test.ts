import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cashShiftsService } from './cashShifts.service'
import { http } from './http'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('cashShiftsService.active', () => {
  it('returns the open shift of the branch', async () => {
    vi.mocked(http.get).mockResolvedValue({ id: 'shift-1', status: 'OPEN' })

    await expect(cashShiftsService.active('branch-1', 'token')).resolves.toEqual({
      id: 'shift-1',
      status: 'OPEN',
    })
    expect(http.get).toHaveBeenCalledWith('/cash-shifts/active?branchId=branch-1', {
      token: 'token',
    })
  })

  it('returns null when the branch has no open shift', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: null })

    await expect(cashShiftsService.active('branch-1', 'token')).resolves.toBeNull()
  })
})

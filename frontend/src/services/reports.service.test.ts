import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from './http'
import { reportsService } from './reports.service'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('reportsService', () => {
  it('asks for the sales report with the branch, dates and page', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [], meta: {} })

    await reportsService.sales(
      { page: 2, limit: 50, branchId: 'branch-1', from: '2026-11-01', to: '2026-11-12' },
      'token',
    )

    expect(http.get).toHaveBeenCalledWith(
      '/reports/sales?page=2&limit=50&branchId=branch-1&from=2026-11-01&to=2026-11-12',
      { token: 'token' },
    )
  })

  it('omits the branch to report every branch', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [], meta: {} })

    await reportsService.sales({ page: 1, branchId: undefined }, 'token')

    expect(http.get).toHaveBeenCalledWith('/reports/sales?page=1', { token: 'token' })
  })
})

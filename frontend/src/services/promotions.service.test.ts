import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BLACK_FRIDAY } from '../test-utils/promotions'

import { http } from './http'
import { promotionsService } from './promotions.service'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('promotionsService', () => {
  it('lists with pagination, search and state filters', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [], meta: {} })

    await promotionsService.list({ page: 2, limit: 20, search: 'black', active: true }, 'token')

    expect(http.get).toHaveBeenCalledWith('/promotions?page=2&limit=20&search=black&active=true', {
      token: 'token',
    })
  })

  it('omits the filters that were not sent', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [], meta: {} })

    await promotionsService.list({ page: 1, search: undefined, active: undefined }, 'token')

    expect(http.get).toHaveBeenCalledWith('/promotions?page=1', { token: 'token' })
  })

  it('returns the active promotion', async () => {
    vi.mocked(http.get).mockResolvedValue(BLACK_FRIDAY)

    await expect(promotionsService.getActive('token')).resolves.toEqual(BLACK_FRIDAY)
    expect(http.get).toHaveBeenCalledWith('/promotions/active', { token: 'token' })
  })

  it('returns null when there is no active promotion', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: null })

    await expect(promotionsService.getActive('token')).resolves.toBeNull()
  })

  it('creates a promotion with its optional dates', async () => {
    vi.mocked(http.post).mockResolvedValue(BLACK_FRIDAY)

    await promotionsService.create(
      { name: 'Black Friday', discountPercentage: '15.00', startDate: '2026-11-01' },
      'token',
    )

    expect(http.post).toHaveBeenCalledWith(
      '/promotions',
      { name: 'Black Friday', discountPercentage: '15.00', startDate: '2026-11-01' },
      { token: 'token' },
    )
  })

  it('updates only the fields sent', async () => {
    vi.mocked(http.patch).mockResolvedValue(BLACK_FRIDAY)

    await promotionsService.update('promo-1', { discountPercentage: '20.00' }, 'token')

    expect(http.patch).toHaveBeenCalledWith(
      '/promotions/promo-1',
      { discountPercentage: '20.00' },
      { token: 'token' },
    )
  })

  it('changes the state through the status endpoint', async () => {
    vi.mocked(http.patch).mockResolvedValue(BLACK_FRIDAY)

    await promotionsService.updateStatus('promo-1', true, 'token')

    expect(http.patch).toHaveBeenCalledWith(
      '/promotions/promo-1/status',
      { active: true },
      { token: 'token' },
    )
  })
})

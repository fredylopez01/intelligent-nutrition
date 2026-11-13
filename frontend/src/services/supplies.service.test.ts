import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from './http'
import { suppliesService } from './supplies.service'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('suppliesService', () => {
  it('lists the supplies and reads the unit abbreviation in both spellings', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: [
        {
          id: 's-1',
          name: 'Leche',
          unitOfMeasure: { id: 'u-1', name: 'Mililitro', abreviation: 'ml' },
        },
        {
          id: 's-2',
          name: 'Avena',
          unitOfMeasure: { id: 'u-2', name: 'Gramo', abbreviation: 'g' },
        },
      ],
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    })

    const response = await suppliesService.list({ page: 1, limit: 100, active: true }, 'token')

    expect(http.get).toHaveBeenCalledWith('/supplies?page=1&limit=100&active=true', {
      token: 'token',
    })
    expect(response.data.map((supply) => supply.unitOfMeasure.abbreviation)).toEqual(['ml', 'g'])
  })
})

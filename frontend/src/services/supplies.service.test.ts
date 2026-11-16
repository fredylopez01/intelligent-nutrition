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

  it('reads the stock of a branch with its filters', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: [
        {
          supplyId: 's-1',
          supply: { name: 'Leche', unitOfMeasure: { id: 'u-1', abbreviation: 'ml' } },
          branchId: 'b-1',
          quantity: '5.000',
          minimumQuantity: '10.000',
          lowStock: true,
          updatedAt: null,
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })

    const response = await suppliesService.stock(
      { page: 1, limit: 20, branchId: 'b-1', lowStock: true },
      'token',
    )

    expect(http.get).toHaveBeenCalledWith(
      '/supply-stock?page=1&limit=20&branchId=b-1&lowStock=true',
      { token: 'token' },
    )
    expect(response.data[0].supply.unitOfMeasure.abbreviation).toBe('ml')
  })

  it('creates supplies, registers movements and saves the minimum', async () => {
    vi.mocked(http.post).mockResolvedValue({
      id: 's-1',
      name: 'Leche',
      unitOfMeasure: { id: 'u-1', name: 'Mililitro', abbreviation: 'ml' },
      active: true,
      createdAt: '',
    })
    vi.mocked(http.patch).mockResolvedValue({
      supplyId: 's-1',
      supply: { name: 'Leche', unitOfMeasure: { id: 'u-1', abbreviation: 'ml' } },
      branchId: 'b-1',
      quantity: '0',
      minimumQuantity: '5',
      lowStock: true,
      updatedAt: null,
    })

    await suppliesService.create({ name: 'Leche', unitOfMeasureId: 'u-1' }, 'token')
    await suppliesService.move(
      { branchId: 'b-1', supplyId: 's-1', movementType: 'ENTRY', quantity: 5 },
      'token',
    )
    await suppliesService.setMinimum(
      { branchId: 'b-1', supplyId: 's-1', minimumQuantity: 5 },
      'token',
    )

    expect(http.post).toHaveBeenCalledWith(
      '/supplies',
      { name: 'Leche', unitOfMeasureId: 'u-1' },
      { token: 'token' },
    )
    expect(http.post).toHaveBeenCalledWith(
      '/supply-stock/movement',
      { branchId: 'b-1', supplyId: 's-1', movementType: 'ENTRY', quantity: 5 },
      { token: 'token' },
    )
    expect(http.patch).toHaveBeenCalledWith(
      '/supply-stock/minimum',
      { branchId: 'b-1', supplyId: 's-1', minimumQuantity: 5 },
      { token: 'token' },
    )
  })
})

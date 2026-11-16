import { beforeEach, describe, expect, it, vi } from 'vitest'

import { catalogService } from './catalog.service'
import { http } from './http'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn() } }
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(http.get).mockResolvedValue({})
})

describe('catalogService', () => {
  it('requests the public products without a token and skips the default sort', async () => {
    await catalogService.products({ page: 2, limit: 12, sort: 'name' })
    await catalogService.products({
      search: 'whey',
      categoryId: 'c-1',
      branchId: 'b-1',
      sort: 'price_desc',
    })

    expect(http.get).toHaveBeenNthCalledWith(1, '/catalog/products?page=2&limit=12')
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      '/catalog/products?search=whey&categoryId=c-1&branchId=b-1&sort=price_desc',
    )
  })

  it('requests the categories and the product detail', async () => {
    await catalogService.categories()
    await catalogService.product('p-1')

    expect(http.get).toHaveBeenCalledWith('/catalog/categories')
    expect(http.get).toHaveBeenCalledWith('/catalog/products/p-1')
  })
})

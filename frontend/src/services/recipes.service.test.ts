import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from './http'
import { recipesService } from './recipes.service'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('recipesService', () => {
  it('lists with pagination, search and state, omitting empty filters', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [], meta: {} })

    await recipesService.list({ page: 2, limit: 20, search: 'bat', active: false }, 'token')
    await recipesService.list({ page: 1, search: undefined, active: undefined }, 'token')

    expect(http.get).toHaveBeenNthCalledWith(
      1,
      '/recipes?page=2&limit=20&search=bat&active=false',
      {
        token: 'token',
      },
    )
    expect(http.get).toHaveBeenNthCalledWith(2, '/recipes?page=1', { token: 'token' })
  })

  it('reads, creates, updates and changes the state', async () => {
    vi.mocked(http.get).mockResolvedValue({})
    vi.mocked(http.post).mockResolvedValue({})
    vi.mocked(http.patch).mockResolvedValue({})
    const payload = {
      name: 'Batido',
      ingredients: [{ supplyId: 's-1', quantity: 30, unitOfMeasureId: 'u-1' }],
    }

    await recipesService.get('r-1', 'token')
    await recipesService.create(payload, 'token')
    await recipesService.update('r-1', { name: 'Batido 2' }, 'token')
    await recipesService.updateStatus('r-1', false, 'token')

    expect(http.get).toHaveBeenCalledWith('/recipes/r-1', { token: 'token' })
    expect(http.post).toHaveBeenCalledWith('/recipes', payload, { token: 'token' })
    expect(http.patch).toHaveBeenCalledWith(
      '/recipes/r-1',
      { name: 'Batido 2' },
      { token: 'token' },
    )
    expect(http.patch).toHaveBeenCalledWith(
      '/recipes/r-1/status',
      { active: false },
      { token: 'token' },
    )
  })
})

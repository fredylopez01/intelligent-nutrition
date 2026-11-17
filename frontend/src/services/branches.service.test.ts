import { beforeEach, describe, expect, it, vi } from 'vitest'

import { branchesService } from './branches.service'
import { http } from './http'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return {
    ...original,
    http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  }
})

const get = vi.mocked(http.get)
const post = vi.mocked(http.post)
const patch = vi.mocked(http.patch)
const put = vi.mocked(http.put)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('branchesService', () => {
  it('lists the branches without filters', async () => {
    get.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } })

    await branchesService.list({}, 'token')

    expect(get).toHaveBeenCalledWith('/branches', { token: 'token' })
  })

  it('encodes every filter in the query', async () => {
    get.mockResolvedValue({ data: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } })

    await branchesService.list({ page: 2, limit: 20, search: 'Makro', active: false }, 'token')

    expect(get).toHaveBeenCalledWith('/branches?page=2&limit=20&search=Makro&active=false', {
      token: 'token',
    })
  })

  it('creates a branch', async () => {
    const branch = {
      id: 'branch-1',
      name: 'Sede Makro',
      address: 'Carrera 10',
      phone: '300',
      active: true,
    }
    post.mockResolvedValue(branch)

    await expect(
      branchesService.create({ name: 'Sede Makro', address: 'Carrera 10', phone: '300' }, 't'),
    ).resolves.toEqual(branch)
    expect(post).toHaveBeenCalledWith(
      '/branches',
      { name: 'Sede Makro', address: 'Carrera 10', phone: '300' },
      { token: 't' },
    )
  })

  it('updates a branch', async () => {
    patch.mockResolvedValue({})

    await branchesService.update('branch-1', { phone: '3009999999' }, 't')

    expect(patch).toHaveBeenCalledWith(
      '/branches/branch-1',
      { phone: '3009999999' },
      { token: 't' },
    )
  })

  it('changes the status of a branch', async () => {
    patch.mockResolvedValue({})

    await branchesService.updateStatus('branch-1', { active: false }, 't')

    expect(patch).toHaveBeenCalledWith(
      '/branches/branch-1/status',
      { active: false },
      { token: 't' },
    )
  })

  it('replaces the schedule of a branch', async () => {
    const days = [{ dayOfWeek: 1, intervals: [{ opensAt: '08:00', closesAt: '18:00' }] }]
    put.mockResolvedValue({})

    await branchesService.updateSchedule('branch-1', { days }, 't')

    expect(put).toHaveBeenCalledWith('/branches/branch-1/schedule', { days }, { token: 't' })
  })
})

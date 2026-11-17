import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from './http'
import { MOCK_USERS } from './mocks/users.mock'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

const get = vi.mocked(http.get)
const post = vi.mocked(http.post)
const patch = vi.mocked(http.patch)

const ASSIGNMENTS_KEY = 'intelligent-nutrition:mock-branch-assignments'

const emptyPage = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }

async function loadService(useMocks: boolean) {
  vi.stubEnv('VITE_USE_MOCKS', String(useMocks))
  vi.resetModules()
  const module = await import('./users.service')
  return module.usersService
}

async function withMockedTimers<T>(run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers()
  try {
    const promise = run()
    promise.catch(() => {})
    await vi.runAllTimersAsync()
    return await promise
  } finally {
    vi.useRealTimers()
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
})

describe('usersService against the API', () => {
  it('lists users with every filter encoded in the query', async () => {
    const service = await loadService(false)
    get.mockResolvedValue(emptyPage)

    await service.list(
      {
        page: 2,
        limit: 20,
        active: false,
        search: 'ana',
        roleId: 'role-1',
        branchId: 'branch-1',
      },
      'token',
    )

    expect(get).toHaveBeenCalledWith(
      '/users?page=2&limit=20&active=false&search=ana&roleId=role-1&branchId=branch-1',
      { token: 'token' },
    )
  })

  it('leaves out the filters that are not set', async () => {
    const service = await loadService(false)
    get.mockResolvedValue(emptyPage)

    await service.list({}, 'token')

    expect(get).toHaveBeenCalledWith('/users', { token: 'token' })
  })

  it('reads a single user', async () => {
    const service = await loadService(false)
    get.mockResolvedValue(MOCK_USERS[0])

    await expect(service.getById('user-1', 'token')).resolves.toEqual(MOCK_USERS[0])
    expect(get).toHaveBeenCalledWith('/users/user-1', { token: 'token' })
  })

  it('creates a user', async () => {
    const service = await loadService(false)
    const payload = { personId: 'person-1', roleId: 'role-1' }
    post.mockResolvedValue(MOCK_USERS[0])

    await service.create(payload, 'token')

    expect(post).toHaveBeenCalledWith('/users', payload, { token: 'token' })
  })

  it('updates a user', async () => {
    const service = await loadService(false)
    const payload = { person: { firstName: 'Nuevo' } }
    patch.mockResolvedValue(MOCK_USERS[0])

    await service.update('user-1', payload, 'token')

    expect(patch).toHaveBeenCalledWith('/users/user-1', payload, { token: 'token' })
  })

  it('changes the role of a user', async () => {
    const service = await loadService(false)
    patch.mockResolvedValue(MOCK_USERS[0])

    await service.updateRole('user-1', { roleId: 'role-2' }, 'token')

    expect(patch).toHaveBeenCalledWith(
      '/users/user-1/role',
      { roleId: 'role-2' },
      { token: 'token' },
    )
  })

  it('changes the status of a user', async () => {
    const service = await loadService(false)
    const response = { message: 'User status updated successfully.' }
    patch.mockResolvedValue(response)

    await expect(service.updateStatus('user-1', { active: false }, 'token')).resolves.toEqual(
      response,
    )
    expect(patch).toHaveBeenCalledWith(
      '/users/user-1/status',
      { active: false },
      { token: 'token' },
    )
  })

  it('lists the branches of a user', async () => {
    const service = await loadService(false)
    get.mockResolvedValue([])

    await service.listBranches('user-1', 'token')

    expect(get).toHaveBeenCalledWith('/users/user-1/branches', { token: 'token' })
  })

  it('assigns a branch to a user', async () => {
    const service = await loadService(false)
    post.mockResolvedValue(undefined)

    await service.assignBranch('user-1', { branchId: 'branch-1' }, 'token')

    expect(post).toHaveBeenCalledWith(
      '/users/user-1/branches',
      { branchId: 'branch-1' },
      {
        token: 'token',
      },
    )
  })

  it('deactivates a branch assignment', async () => {
    const service = await loadService(false)
    patch.mockResolvedValue(undefined)

    await service.deactivateBranch('user-1', 'branch-1', 'token')

    expect(patch).toHaveBeenCalledWith(
      '/users/user-1/branches/branch-1',
      { active: false },
      { token: 'token' },
    )
  })

  it('resends the invitation email', async () => {
    const service = await loadService(false)
    const response = { message: 'Activation email sent successfully' }
    post.mockResolvedValue(response)

    await expect(service.resendInvitation('ana@test.com', 'token')).resolves.toEqual(response)
    expect(post).toHaveBeenCalledWith('/auth/resend', { email: 'ana@test.com' }, { token: 'token' })
  })
})

describe('usersService with mocks enabled', () => {
  it('filters by status and paginates the mocked users', async () => {
    const service = await loadService(true)

    const result = await withMockedTimers(() =>
      service.list({ page: 1, limit: 10, active: false }, null),
    )

    expect(result.data).toEqual(MOCK_USERS.filter((user) => !user.active))
    expect(result.meta.total).toBe(result.data.length)
  })

  it('searches by name and by email ignoring the case', async () => {
    const service = await loadService(true)

    const byName = await withMockedTimers(() => service.list({ search: '  NATALIA ' }, null))
    const byEmail = await withMockedTimers(() => service.list({ search: 'natalia.bernal' }, null))

    expect(byName.data.map((user) => user.id)).toEqual(['u-1'])
    expect(byEmail.data.map((user) => user.id)).toEqual(['u-1'])
  })

  it('filters by role and slices the requested page', async () => {
    const service = await loadService(true)

    const leaders = await withMockedTimers(() =>
      service.list({ roleId: 'role-branch-leader', page: 1, limit: 2 }, null),
    )

    expect(leaders.data).toHaveLength(2)
    expect(leaders.data.every((user) => user.role.id === 'role-branch-leader')).toBe(true)
    expect(leaders.meta.totalPages).toBe(Math.ceil(leaders.meta.total / 2))
  })

  it('returns a mocked user by id and throws when it does not exist', async () => {
    const service = await loadService(true)

    await expect(withMockedTimers(() => service.getById('u-1', null))).resolves.toEqual(
      MOCK_USERS[0],
    )
    await expect(withMockedTimers(() => service.getById('missing', null))).rejects.toThrow(
      'User not found',
    )
  })

  it('creates a mocked user from a person payload', async () => {
    const service = await loadService(true)

    const created = await withMockedTimers(() =>
      service.create(
        {
          person: {
            documentTypeId: 'cc',
            documentNumber: '123',
            firstName: 'Ana',
            lastName: 'Perez',
            email: 'ana@test.com',
            phone: '300',
            address: 'Calle 1',
          },
          roleId: 'role-1',
        },
        null,
      ),
    )

    expect(created.person.firstName).toBe('Ana')
    expect(created.role.name).toBe('Rol simulado')
    expect(created.active).toBe(true)
  })

  it('creates a mocked user from an existing person id', async () => {
    const service = await loadService(true)

    const created = await withMockedTimers(() =>
      service.create({ personId: 'person-9', roleId: 'role-1' }, null),
    )

    expect(created.person.firstName).toBeNull()
    expect(created.person.email).toBeNull()
  })

  it('updates the person data of a mocked user', async () => {
    const service = await loadService(true)

    const updated = await withMockedTimers(() =>
      service.update('u-1', { person: { firstName: 'Natalia', phone: '3001234567' } }, null),
    )

    expect(updated.person.firstName).toBe('Natalia')
    expect(updated.person.phone).toBe('3001234567')
  })

  it('changes the role of a mocked user', async () => {
    const service = await loadService(true)

    const updated = await withMockedTimers(() =>
      service.updateRole('u-2', { roleId: 'role-branch-assistant' }, null),
    )

    expect(updated.role).toEqual({ id: 'role-branch-assistant', name: 'Rol simulado' })
  })

  it('reports the status change of a mocked user', async () => {
    const service = await loadService(true)

    await expect(
      withMockedTimers(() => service.updateStatus('u-1', { active: false }, null)),
    ).resolves.toEqual({ message: 'User status updated successfully.' })
  })

  it('starts with no branch assignments and stores a new one', async () => {
    const service = await loadService(true)

    await expect(withMockedTimers(() => service.listBranches('u-1', null))).resolves.toEqual([])

    await withMockedTimers(() => service.assignBranch('u-1', { branchId: 'branch-viva' }, null))
    const assignments = await withMockedTimers(() => service.listBranches('u-1', null))

    expect(assignments).toHaveLength(1)
    expect(assignments[0]).toMatchObject({ id: 'branch-viva', name: 'Sede Viva', active: true })
    expect(JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) ?? '{}')).toHaveProperty('u-1')
  })

  it('does not duplicate an active assignment', async () => {
    const service = await loadService(true)

    await withMockedTimers(() => service.assignBranch('u-1', { branchId: 'branch-makro' }, null))
    await withMockedTimers(() => service.assignBranch('u-1', { branchId: 'branch-makro' }, null))
    const assignments = await withMockedTimers(() => service.listBranches('u-1', null))

    expect(assignments).toHaveLength(1)
  })

  it('deactivates a mocked branch assignment', async () => {
    const service = await loadService(true)

    await withMockedTimers(() => service.assignBranch('u-1', { branchId: 'branch-makro' }, null))
    await withMockedTimers(() => service.deactivateBranch('u-1', 'branch-makro', null))

    await expect(withMockedTimers(() => service.listBranches('u-1', null))).resolves.toEqual([])

    const stored = JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) ?? '{}')
    expect(stored['u-1'][0]).toMatchObject({ active: false })
    expect(stored['u-1'][0].endDate).not.toBeNull()
  })

  it('ignores a corrupted assignment store', async () => {
    const service = await loadService(true)
    localStorage.setItem(ASSIGNMENTS_KEY, 'not-json')

    await expect(withMockedTimers(() => service.listBranches('u-1', null))).resolves.toEqual([])
  })

  it('reports the resend of a mocked invitation', async () => {
    const service = await loadService(true)

    await expect(
      withMockedTimers(() => service.resendInvitation('ana@test.com', null)),
    ).resolves.toEqual({ message: 'Activation email sent successfully' })
  })
})

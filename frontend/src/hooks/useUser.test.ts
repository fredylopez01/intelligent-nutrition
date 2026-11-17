import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../services/http'
import { usersService } from '../services/users.service'
import type { User } from '../types/user'

import { useAuth } from './useAuth'
import { useUser } from './useUser'

vi.mock('./useAuth', () => ({ useAuth: vi.fn() }))

vi.mock('../services/users.service', () => ({
  usersService: { getById: vi.fn() },
}))

const user: User = {
  id: 'u-1',
  personId: 'p-1',
  person: {
    id: 'p-1',
    firstName: 'Ana',
    lastName: 'Perez',
    email: 'ana@test.com',
    phone: null,
    address: null,
  },
  role: { id: 'role-1', name: 'BRANCH_LEADER' },
  branches: [],
  active: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(useAuth).mockReturnValue({ token: 'token' } as unknown as ReturnType<typeof useAuth>)
})

describe('useUser', () => {
  it('returns not-found without calling the API when there is no id', () => {
    const { result } = renderHook(() => useUser(undefined))

    expect(result.current.status).toBe('not-found')
    expect(usersService.getById).not.toHaveBeenCalled()
  })

  it('starts loading and then exposes the user', async () => {
    vi.mocked(usersService.getById).mockResolvedValue(user)

    const { result } = renderHook(() => useUser('u-1'))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.user).toEqual(user)
    expect(usersService.getById).toHaveBeenCalledWith('u-1', 'token')
  })

  it.each([404, 400])('reports a %i response as not-found', async (status) => {
    vi.mocked(usersService.getById).mockRejectedValue(new ApiError('missing', status))

    const { result } = renderHook(() => useUser('u-1'))

    await waitFor(() => expect(result.current.status).toBe('not-found'))
    expect(result.current.user).toBeNull()
  })

  it('reports other errors with their message', async () => {
    vi.mocked(usersService.getById).mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useUser('u-1'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('boom')
  })

  it('falls back to a generic message for a non Error rejection', async () => {
    vi.mocked(usersService.getById).mockRejectedValue('boom')

    const { result } = renderHook(() => useUser('u-1'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('No fue posible cargar el usuario. Intenta de nuevo.')
  })

  it('refetches the user', async () => {
    vi.mocked(usersService.getById).mockResolvedValue(user)

    const { result } = renderHook(() => useUser('u-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.refetch())

    await waitFor(() => expect(usersService.getById).toHaveBeenCalledTimes(2))
  })
})

import { describe, expect, it } from 'vitest'

import type { OwnProfile } from '../types/profile'

import { buildProfilePayload, buildProfileSchema, profileFullName } from './profile'

const initial = { firstName: 'Laura', lastName: 'Restrepo', phone: '', address: 'Calle 1' }

describe('profile utils', () => {
  it('only keeps the trimmed fields that changed', () => {
    expect(
      buildProfilePayload(
        { firstName: ' Laura ', lastName: 'Gómez', phone: '300', address: 'Calle 1' },
        initial,
      ),
    ).toEqual({ lastName: 'Gómez', phone: '300' })
  })

  it('rejects clearing a saved value but allows an optional field to stay empty', () => {
    const schema = buildProfileSchema(initial)

    expect(schema.safeParse({ ...initial, address: '  ' }).success).toBe(false)
    expect(schema.safeParse({ ...initial, phone: '' }).success).toBe(true)
    expect(schema.safeParse({ ...initial, phone: '300 12' }).success).toBe(false)
  })

  it('builds the full name and falls back to the business name or the email', () => {
    const base = {
      email: 'tienda@example.com',
      person: { firstName: null, lastName: null, businessName: null },
    } as unknown as OwnProfile

    expect(profileFullName(base)).toBe('tienda@example.com')
    expect(
      profileFullName({ ...base, person: { ...base.person, businessName: 'Tienda SAS' } }),
    ).toBe('Tienda SAS')
    expect(
      profileFullName({ ...base, person: { ...base.person, firstName: 'Ana', lastName: 'Ruiz' } }),
    ).toBe('Ana Ruiz')
  })
})

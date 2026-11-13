import { z } from 'zod'

import { ApiError } from '../services/http'
import type { OwnProfile, UpdateOwnProfilePayload } from '../types/profile'

export const PROFILE_FIELDS = ['firstName', 'lastName', 'phone', 'address'] as const

export type ProfileField = (typeof PROFILE_FIELDS)[number]

export type ProfileFormValues = Record<ProfileField, string>

const MAX_LENGTHS: Record<ProfileField, number> = {
  firstName: 100,
  lastName: 100,
  phone: 30,
  address: 255,
}

const CLEAR_MESSAGES: Record<ProfileField, string> = {
  firstName: 'Escribe tus nombres.',
  lastName: 'Escribe tus apellidos.',
  phone: 'El teléfono no puede quedar vacío. Escribe el nuevo número.',
  address: 'La dirección no puede quedar vacía. Escribe la nueva dirección.',
}

export function profileFormValues(profile: OwnProfile): ProfileFormValues {
  return {
    firstName: profile.person.firstName ?? '',
    lastName: profile.person.lastName ?? '',
    phone: profile.person.phone ?? '',
    address: profile.person.address ?? '',
  }
}

export function profileFullName(profile: OwnProfile): string {
  const name = [profile.person.firstName, profile.person.lastName]
    .filter((part) => part && part.trim())
    .join(' ')
  return name || profile.person.businessName || profile.email
}

export function buildProfileSchema(initial: ProfileFormValues) {
  const field = (key: ProfileField) =>
    z
      .string()
      .trim()
      .max(MAX_LENGTHS[key], `No puede superar los ${MAX_LENGTHS[key]} caracteres.`)
      .refine((value) => value !== '' || initial[key].trim() === '', CLEAR_MESSAGES[key])

  return z.object({
    firstName: field('firstName'),
    lastName: field('lastName'),
    phone: field('phone').refine(
      (value) => value === '' || /^\d+$/.test(value),
      'Escribe solo números, sin espacios ni guiones.',
    ),
    address: field('address'),
  })
}

export function buildProfilePayload(
  values: ProfileFormValues,
  initial: ProfileFormValues,
): UpdateOwnProfilePayload {
  const payload: UpdateOwnProfilePayload = {}
  for (const key of PROFILE_FIELDS) {
    const value = values[key].trim()
    if (value !== '' && value !== initial[key].trim()) payload[key] = value
  }
  return payload
}

export function resolveProfileError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  if (error.status === 404) return 'No encontramos tu cuenta. Vuelve a iniciar sesión.'
  if (error.status === 400) return 'Revisa los datos: hay un valor que el servidor no aceptó.'
  return fallback
}

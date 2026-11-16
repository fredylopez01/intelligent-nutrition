import type { RoleName } from './auth'

export interface OwnProfilePerson {
  id: string
  documentNumber: string | null
  firstName: string | null
  lastName: string | null
  businessName: string | null
  email: string | null
  phone: string | null
  address: string | null
  profilePhotoUrl: string | null
  documentType: { code: string; name: string } | null
}

export interface OwnProfile {
  id: string
  email: string
  role: { id: string; name: RoleName }
  person: OwnProfilePerson
  branches: { id: string; name: string }[]
  createdAt: string
  updatedAt: string
}

export interface UpdateOwnProfilePayload {
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
}

import type { PaginationMeta } from './user'

export interface SupplyUnit {
  id: string
  name?: string
  abbreviation: string
}

export interface Supply {
  id: string
  name: string
  unitOfMeasure: SupplyUnit
  active: boolean
  createdAt: string
  updatedAt?: string
}

export interface SuppliesListParams {
  page?: number
  limit?: number
  search?: string
  active?: boolean
}

export interface SuppliesListResponse {
  data: Supply[]
  meta: PaginationMeta
}

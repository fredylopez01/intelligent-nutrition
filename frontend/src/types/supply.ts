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

export interface CreateSupplyPayload {
  name: string
  unitOfMeasureId: string
}

export interface SupplyStockRow {
  supplyId: string
  supply: {
    name: string
    unitOfMeasure: { id: string; abbreviation: string }
  }
  branchId: string
  branchName?: string
  quantity: string
  minimumQuantity: string
  lowStock: boolean
  updatedAt: string | null
}

export interface SupplyStockParams {
  page?: number
  limit?: number
  branchId?: string
  search?: string
  lowStock?: boolean
}

export interface SupplyStockResponse {
  data: SupplyStockRow[]
  meta: PaginationMeta
}

export type SupplyMovementType = 'ENTRY' | 'EXIT'

export interface SupplyMovementPayload {
  branchId: string
  supplyId: string
  movementType: SupplyMovementType
  quantity: number
  observation?: string
}

export interface SupplyMovement {
  id: string
  movementType: SupplyMovementType
  quantity: string
  supply: { id: string; name: string }
  branch: { id: string; name: string }
  user: { id: string; fullName: string | null }
  observation: string | null
  resultingQuantity: string
  movementAt: string
}

export interface UpdateSupplyMinimumPayload {
  branchId: string
  supplyId: string
  minimumQuantity: number
}

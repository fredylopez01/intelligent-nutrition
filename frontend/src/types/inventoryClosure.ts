import type { PaginationMeta } from './user'

export type ClosureStatus = 'PENDING' | 'CONFIRMED' | 'NOT_CONFIRMED'

export interface ClosureItem {
  productId: string
  productName: string
  referenceCode: string
  unit: string
  expirationDate: string | null
  physicalQuantity: number | null
  observation: string | null
  systemQuantity?: number
  difference?: number | null
}

export interface ClosureSupplyItem {
  supplyId: string
  supplyName: string
  unit: string
  systemQuantity: string
  physicalQuantity: string | null
  observation: string | null
  difference?: string | null
}

export interface InventoryClosure {
  id: string
  branchId: string
  cashShiftId?: string | null
  branchName: string
  closureDate: string
  status: ClosureStatus
  confirmed: boolean
  locked: boolean
  closedAt: string | null
  userName: string | null
  countedItems: number
  totalItems: number
  totalDifferences?: number
  items: ClosureItem[]
  countedSupplies?: number
  totalSupplies?: number
  totalSupplyDifferences?: number
  supplyItems?: ClosureSupplyItem[]
}

export type ClosureSummary = Omit<
  InventoryClosure,
  'items' | 'totalDifferences' | 'supplyItems' | 'totalSupplyDifferences'
> & {
  totalDifferences?: number | null
}

export interface ClosuresListParams {
  page?: number
  limit?: number
  branchId?: string
  status?: ClosureStatus
  from?: string
  to?: string
}

export interface ClosuresListResponse {
  data: ClosureSummary[]
  meta: PaginationMeta
}

export interface ClosureCount {
  productId: string
  expirationDate: string
  physicalQuantity: number
  observation?: string
}

export interface ClosureSupplyCount {
  supplyId: string
  physicalQuantity: number
  observation?: string
}

export interface ClosureCountsPayload {
  items?: ClosureCount[]
  supplyItems?: ClosureSupplyCount[]
}

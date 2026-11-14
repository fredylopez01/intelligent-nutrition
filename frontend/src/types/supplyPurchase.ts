import type { PaginationMeta } from './user'

export type SupplyPurchaseStatus = 'PENDING_RECEIPT' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED'

export interface SupplyPurchaseItem {
  id: string
  supply: { id: string; name: string; unit: string; unitName: string }
  requestedQuantity: number
  receivedQuantity: number
  pendingQuantity: number
  unitCost: string
  subtotal: string
}

export interface SupplyPurchase {
  id: string
  purchaseNumber: string
  status: SupplyPurchaseStatus
  purchaseAt: string
  total: string
  observation: string | null
  supplier: { id: string; name: string }
  user: { id: string; fullName: string }
  items: SupplyPurchaseItem[]
}

export interface SupplyPurchasesListParams {
  page?: number
  limit?: number
  status?: SupplyPurchaseStatus
  supplierId?: string
  search?: string
}

export interface SupplyPurchasesListResponse {
  data: SupplyPurchase[]
  meta: PaginationMeta
}

export interface CreateSupplyPurchasePayload {
  supplierId: string
  observation?: string
  items: { supplyId: string; quantity: number; unitCost: string }[]
}

export interface ReceiveSupplyPurchasePayload {
  branchId: string
  observation?: string
  items: { detailId: string; quantity: number }[]
}

import type { PaginationMeta } from './user'

export type OnlineOrderStatus =
  'PENDING' | 'CONFIRMED' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED'

export type OnlineOrderFulfillment = 'PICKUP' | 'DELIVERY'

export interface CartItem {
  productId: string
  name: string
  referenceCode: string
  price: string
  imageUrl: string | null
  quantity: number
}

export interface OrderLine {
  productId: string
  quantity: number
}

export interface BranchCartAvailability {
  branchId: string
  name: string
  address: string
  phone: string
  deliveryEnabled: boolean
  allAvailable: boolean
  items: { productId: string; available: number }[]
}

export interface CartAvailability {
  products: { productId: string; name: string; price: string; quantity: number }[]
  branches: BranchCartAvailability[]
  deliveryAvailable: boolean
}

export interface OrderDocumentType {
  id: string
  code: string
  name: string
}

export interface CreateOnlineOrderPayload {
  fulfillment: OnlineOrderFulfillment
  branchId?: string
  items: OrderLine[]
  customer: {
    firstName: string
    lastName: string
    phone: string
    email?: string
    register: boolean
    documentTypeId?: string
    documentNumber?: string
    businessName?: string
    address?: string
  }
  delivery?: { address: string; neighborhood: string }
  notes?: string
}

export interface OnlineOrder {
  id: string
  code: string
  status: OnlineOrderStatus
  fulfillment: OnlineOrderFulfillment
  branch: { id: string; name: string; address: string; phone: string }
  customer: {
    id: string | null
    name: string
    phone: string
    email: string | null
    registered: boolean
  }
  delivery: { address: string | null; neighborhood: string | null } | null
  notes: string | null
  items: {
    productId: string
    name: string
    referenceCode: string
    quantity: number
    unitPrice: string
    total: string
  }[]
  subtotal: string
  expiresAt: string
  sale: { id: string; saleNumber: string; total: string } | null
  cancelReason: string | null
  confirmedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  createdAt: string
}

export interface OnlineOrdersListParams {
  page?: number
  limit?: number
  status?: OnlineOrderStatus
  fulfillment?: OnlineOrderFulfillment
  branchId?: string
  search?: string
}

export interface OnlineOrdersListResponse {
  data: OnlineOrder[]
  meta: PaginationMeta & { openOrders: number }
}

export type ManualOrderStatus = 'CONFIRMED' | 'READY' | 'OUT_FOR_DELIVERY' | 'CANCELLED'

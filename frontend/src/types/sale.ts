import type { PaginationMeta } from './user'

export type SaleStatus = 'COMPLETED' | 'REVERSED'

export interface SellableProduct {
  productId: string
  name: string
  referenceCode: string
  primaryImageUrl: string | null
  price: string
  availableQuantity: number
  reservedQuantity?: number
  unit?: string
  category?: { id: string; name: string }
  prepared?: boolean
  recipeId?: string | null
}

export interface SellableProductsParams {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
}

export interface SellableProductsResponse {
  data: SellableProduct[]
  meta: PaginationMeta
}

export interface SaleCustomer {
  id: string
  fullName: string
  documentType?: { code: string; name: string }
  documentNumber?: string
  email?: string
  phone?: string
  address?: string
  isCompany?: boolean
}

export interface SaleSummary {
  id: string
  saleNumber: string
  status: SaleStatus
  branch: { id: string; name: string }
  user: { id: string; fullName: string }
  customer: SaleCustomer | null
  saleAt: string
  subtotal: string
  discountAmount: string
  taxAmount: string
  total: string
  reversalReason: string | null
  reversedAt: string | null
  itemsCount: number
}

export interface SaleItem {
  productId: string
  productName: string
  referenceCode: string
  recipeId?: string | null
  quantity: number
  unitPrice: string
  subtotal: string
  discountAmount: string
  taxAmount: string
  total: string
}

export interface SalePayment {
  paymentMethod: { id: string; code: string; name: string }
  amount: string
  reference: string | null
  paidAt: string
}

export interface Sale extends Omit<SaleSummary, 'itemsCount'> {
  discountReason?: string | null
  promotionId?: string | null
  promotionDiscount?: string | null
  items: SaleItem[]
  payments: SalePayment[]
}

export interface SalesListParams {
  page?: number
  limit?: number
  branchId?: string
  status?: SaleStatus
  from?: string
  to?: string
  search?: string
}

export interface SalesListResponse {
  data: SaleSummary[]
  meta: PaginationMeta
}

export interface CreateSalePayload {
  branchId: string
  customerId?: string | null
  items: { productId: string; quantity: number; recipeId?: string }[]
  promotionId?: string | null
  discountAmount?: string
  discountReason?: string | null
  payments: { paymentMethodId: string; amount: string; reference?: string | null }[]
}

export interface PaymentDraft {
  id: string
  paymentMethodId: string
  amount: string
  reference: string
}

export type CustomDiscountType = 'percentage' | 'amount'

export type DiscountChoice =
  | { kind: 'none' }
  | { kind: 'promotion'; promotionId: string }
  | { kind: 'custom'; type: CustomDiscountType; value: string; reason: string }

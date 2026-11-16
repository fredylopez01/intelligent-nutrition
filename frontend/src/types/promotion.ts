import type { PaginationMeta } from './user'

export interface Promotion {
  id: string
  name: string
  discountPercentage: string
  startDate: string | null
  endDate: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface PromotionsListParams {
  page?: number
  limit?: number
  active?: boolean
  search?: string
}

export interface PromotionsListResponse {
  data: Promotion[]
  meta: PaginationMeta
}

export interface CreatePromotionPayload {
  name: string
  discountPercentage: string
  startDate?: string
  endDate?: string
}

export type UpdatePromotionPayload = Partial<CreatePromotionPayload>

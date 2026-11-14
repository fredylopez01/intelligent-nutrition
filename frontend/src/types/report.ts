import type { PaginationMeta } from './user'

export interface SalesReportRow {
  day: string
  branch: { id: string; name: string }
  salesCount: number
  totalAmount: string
}

export interface SalesReportParams {
  page?: number
  limit?: number
  branchId?: string
  from?: string
  to?: string
}

export interface SalesReportResponse {
  data: SalesReportRow[]
  meta: PaginationMeta
}

export interface DashboardEmbed {
  url: string
}

export interface RestockReportRow {
  productId: string
  name: string
  referenceCode: string
  branchId: string
  branchName: string
  currentQuantity: number
  minimumStock: number
  deficit: number
  projectedDemand7d: number
  suggestedUnits: number
}

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

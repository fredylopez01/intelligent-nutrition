import type { RestockReportRow, SalesReportParams, SalesReportResponse } from '../types/report'

import { http } from './http'

const REPORTS_PATH = '/reports'

function buildQuery(params: object): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const reportsService = {
  sales: (params: SalesReportParams, token: string | null) =>
    http.get<SalesReportResponse>(`${REPORTS_PATH}/sales${buildQuery(params)}`, { token }),

  restock: (params: { branchId?: string }, token: string | null) =>
    http.get<RestockReportRow[]>(`${REPORTS_PATH}/restock${buildQuery(params)}`, { token }),
}

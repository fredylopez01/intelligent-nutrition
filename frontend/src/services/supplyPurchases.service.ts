import type {
  CreateSupplyPurchasePayload,
  ReceiveSupplyPurchasePayload,
  SupplyPurchase,
  SupplyPurchasesListParams,
  SupplyPurchasesListResponse,
} from '../types/supplyPurchase'

import { http } from './http'

const PATH = '/supply-purchases'

function buildQuery(params: SupplyPurchasesListParams): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const supplyPurchasesService = {
  list: (params: SupplyPurchasesListParams, token: string | null) =>
    http.get<SupplyPurchasesListResponse>(`${PATH}${buildQuery(params)}`, { token }),

  get: (id: string, token: string | null) => http.get<SupplyPurchase>(`${PATH}/${id}`, { token }),

  create: (payload: CreateSupplyPurchasePayload, token: string | null) =>
    http.post<SupplyPurchase>(PATH, payload, { token }),

  receive: (id: string, payload: ReceiveSupplyPurchasePayload, token: string | null) =>
    http.post<SupplyPurchase>(`${PATH}/${id}/receipts`, payload, { token }),
}

import type {
  CartAvailability,
  CreateOnlineOrderPayload,
  ManualOrderStatus,
  OnlineOrder,
  OnlineOrdersListParams,
  OnlineOrdersListResponse,
  OrderDocumentType,
  OrderLine,
} from '../types/onlineOrder'
import type { Sale } from '../types/sale'

import { http } from './http'

const PATH = '/orders'

function buildQuery(params: OnlineOrdersListParams): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const onlineOrdersService = {
  availability: (items: OrderLine[]): Promise<CartAvailability> =>
    http.post<CartAvailability>(`${PATH}/availability`, { items }),

  documentTypes: (): Promise<OrderDocumentType[]> =>
    http.get<OrderDocumentType[]>(`${PATH}/document-types`),

  create: (payload: CreateOnlineOrderPayload): Promise<OnlineOrder> =>
    http.post<OnlineOrder>(PATH, payload),

  list: (params: OnlineOrdersListParams, token: string | null) =>
    http.get<OnlineOrdersListResponse>(`${PATH}${buildQuery(params)}`, { token }),

  get: (id: string, token: string | null) => http.get<OnlineOrder>(`${PATH}/${id}`, { token }),

  updateStatus: (
    id: string,
    payload: { status: ManualOrderStatus; reason?: string },
    token: string | null,
  ) => http.patch<OnlineOrder>(`${PATH}/${id}/status`, payload, { token }),

  complete: (
    id: string,
    payload: { paymentMethodId: string; reference?: string },
    token: string | null,
  ) => http.post<{ order: OnlineOrder; sale: Sale }>(`${PATH}/${id}/complete`, payload, { token }),
}

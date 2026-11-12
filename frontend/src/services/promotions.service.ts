import type {
  CreatePromotionPayload,
  Promotion,
  PromotionsListParams,
  PromotionsListResponse,
  UpdatePromotionPayload,
} from '../types/promotion'

import { http } from './http'

const PROMOTIONS_PATH = '/promotions'

function buildPromotionsQuery(params: PromotionsListParams): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const promotionsService = {
  list: (params: PromotionsListParams, token: string | null) =>
    http.get<PromotionsListResponse>(`${PROMOTIONS_PATH}${buildPromotionsQuery(params)}`, {
      token,
    }),

  getActive: async (token: string | null): Promise<Promotion | null> => {
    const result = await http.get<Promotion | { data: null } | null>(`${PROMOTIONS_PATH}/active`, {
      token,
    })
    return result && 'id' in result ? result : null
  },

  listApplicable: (token: string | null) =>
    http.get<Promotion[]>(`${PROMOTIONS_PATH}/applicable`, { token }),

  create: (payload: CreatePromotionPayload, token: string | null) =>
    http.post<Promotion>(PROMOTIONS_PATH, payload, { token }),

  update: (promotionId: string, payload: UpdatePromotionPayload, token: string | null) =>
    http.patch<Promotion>(`${PROMOTIONS_PATH}/${promotionId}`, payload, { token }),

  updateStatus: (promotionId: string, active: boolean, token: string | null) =>
    http.patch<Promotion>(`${PROMOTIONS_PATH}/${promotionId}/status`, { active }, { token }),
}

import type {
  CashShift,
  CashShiftsListParams,
  CashShiftsListResponse,
  CloseCashShiftPayload,
  OpenCashShiftPayload,
} from '../types/cashShift'

import { http } from './http'

const BASE = '/cash-shifts'

function buildQuery(params: CashShiftsListParams): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const cashShiftsService = {
  open: (payload: OpenCashShiftPayload, token: string | null) =>
    http.post<CashShift>(BASE, payload, { token }),

  close: (shiftId: string, payload: CloseCashShiftPayload, token: string | null) =>
    http.patch<CashShift>(`${BASE}/${shiftId}/close`, payload, { token }),

  list: (params: CashShiftsListParams, token: string | null) =>
    http.get<CashShiftsListResponse>(`${BASE}${buildQuery(params)}`, { token }),

  findOne: (shiftId: string, token: string | null) =>
    http.get<CashShift>(`${BASE}/${shiftId}`, { token }),

  active: async (branchId: string, token: string | null): Promise<CashShift | null> => {
    const result = await http.get<CashShift | { data: null } | null>(
      `${BASE}/active${buildQuery({ branchId })}`,
      { token },
    )
    return result && 'id' in result ? result : null
  },
}

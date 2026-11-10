import type { PaginationMeta } from './user'

export type CashShiftStatus = 'OPEN' | 'CLOSED'

export interface CashShiftBranch {
  id: string
  name: string
}

export interface CashShiftUserRef {
  id: string
  fullName: string | null
}

export interface CashShift {
  id: string
  branch: CashShiftBranch
  user: CashShiftUserRef
  status: CashShiftStatus
  openedAt: string
  closedAt: string | null
  openingAmount: string
  closingAmount: string | null
  observation: string | null
}

export type CashShiftSummary = Omit<CashShift, 'observation'>

export interface OpenCashShiftPayload {
  branchId: string
  openingAmount: string
  observation?: string
}

export interface CloseCashShiftPayload {
  closingAmount: string
  observation?: string
}

export interface CashShiftsListParams {
  page?: number
  limit?: number
  branchId?: string
  status?: CashShiftStatus
  from?: string
  to?: string
  userId?: string
}

export interface CashShiftsListResponse {
  data: CashShiftSummary[]
  meta: PaginationMeta
}

import type { BranchDashboard } from '../types/dashboard'

import { http } from './http'

export const dashboardService = {
  branch: (branchId: string, token: string | null) =>
    http.get<BranchDashboard>(`/dashboard/branch/${encodeURIComponent(branchId)}`, { token }),

  global: (token: string | null) => http.get<BranchDashboard>('/dashboard/global', { token }),
}

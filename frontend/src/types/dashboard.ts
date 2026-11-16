export type DashboardAlertType = 'OUT_OF_STOCK' | 'LAST_UNIT' | 'BELOW_MINIMUM' | 'EXPIRING'

export interface DashboardBranchRef {
  id: string
  name: string
}

export interface DashboardAlert {
  type: DashboardAlertType
  productId: string
  productName: string
  referenceCode: string
  quantity: number
  branches: DashboardBranchRef[]
  expirationDate: string | null
}

export interface DashboardTopProduct {
  productId: string
  name: string
  referenceCode: string
  quantity: number
  total: number
}

export interface DashboardBranchSummary {
  branchId: string
  name: string
  open: boolean
  salesToday: number
  salesCount: number
  lowStockProducts: number
}

export interface DashboardTopBranch {
  branchId: string
  name: string
  total: string
}

export interface BranchDashboard {
  date: string
  branch: DashboardBranchRef | null
  salesToday: {
    count: number
    totalAmount: number
  }
  salesYesterdayUntilNow: number
  salesLast7Days: { date: string; totalAmount: number }[]
  uniqueCustomersToday: number
  criticalStockProducts: number
  monthlyRevenue: number
  stock: {
    totalUnits: number
    byCategory: { categoryId: string; name: string; units: number }[]
  }
  branches: {
    active: number
    open: number
    items: DashboardBranchSummary[]
  }
  alerts: {
    total: number
    lowStockProducts: number
    items: DashboardAlert[]
  }
  topProducts: DashboardTopProduct[]
  totalSalesToday?: string
  totalSalesCount?: number
  branchesActive?: number
  lowStockAlerts?: number
  topBranch?: DashboardTopBranch | null
}

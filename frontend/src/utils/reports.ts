import { ApiError } from '../services/http'
import type { RoleName } from '../types/auth'
import type { SalesReportRow } from '../types/report'

import { businessToday } from './inventoryClosures'
import { toCents } from './sales'

export const REPORT_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER']
export const DEFAULT_REPORT_DAYS = 30

export function shiftDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function defaultReportRange(now: Date = new Date()): { from: string; to: string } {
  const to = businessToday(now)
  return { from: shiftDate(to, -(DEFAULT_REPORT_DAYS - 1)), to }
}

export interface SalesReportSummary {
  totalCents: number
  salesCount: number
  averageCents: number
}

export function summarizeSalesReport(rows: SalesReportRow[]): SalesReportSummary {
  const totalCents = rows.reduce((sum, row) => sum + toCents(row.totalAmount), 0)
  const salesCount = rows.reduce((sum, row) => sum + row.salesCount, 0)
  return {
    totalCents,
    salesCount,
    averageCents: salesCount > 0 ? Math.round(totalCents / salesCount) : 0,
  }
}

export function resolveReportError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case 'INVALID_DATE_RANGE':
      return 'La fecha inicial debe ser anterior o igual a la fecha final.'
    case 'DATE_RANGE_TOO_WIDE':
      return 'El rango de fechas no puede superar 90 días.'
    case 'BRANCH_SCOPE_VIOLATION':
      return 'No tienes acceso a esta sede.'
  }
  if (error.status === 403) return 'Solo el superadmin y el líder de sede pueden ver los reportes.'
  if (error.status === 400) return 'Revisa los filtros: hay un valor que el servidor no aceptó.'
  return fallback
}

export function resolveDashboardEmbedError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'DASHBOARD_NOT_CONFIGURED') {
      return 'El dashboard todavía no está configurado en el servidor. Avisa al equipo técnico para que agregue la URL del informe.'
    }
    if (error.status === 403) return 'Solo el superadmin puede ver el dashboard.'
  }
  return 'No fue posible cargar el dashboard. Intenta de nuevo.'
}

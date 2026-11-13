import { ApiError } from '../services/http'
import type { RoleName } from '../types/auth'
import type { DashboardAlert, DashboardAlertType } from '../types/dashboard'

import { formatExpirationDate } from './inventory'

export const DASHBOARD_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT']

export const CRITICAL_STOCK_THRESHOLD = 5

export const GLOBAL_SCOPE = 'global'

const DAY_MS = 24 * 60 * 60 * 1000

const weekdayFormatter = new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'UTC' })

const longDayFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

const percentFormatter = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function toUtcDate(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`)
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1)
}

export function greetingName(fullName: string | undefined): string {
  return fullName?.trim().split(/\s+/)[0] ?? ''
}

export function todayLabel(isoDate: string): string {
  const date = toUtcDate(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  return capitalize(longDayFormatter.format(date).replace(',', ''))
}

export function weekdayLabel(isoDate: string, today: string): string {
  if (isoDate === today) return 'Hoy'
  const date = toUtcDate(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  return capitalize(weekdayFormatter.format(date).replace('.', ''))
}

export function salesChange(today: number, yesterday: number): number | null {
  if (yesterday <= 0) return null
  return ((today - yesterday) / yesterday) * 100
}

export function averageTicket(total: number, count: number): number | null {
  return count > 0 ? total / count : null
}

export function salesShare(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0
}

export function formatShare(share: number): string {
  return `${Math.round(share)}%`
}

export function formatChange(change: number): string {
  const sign = change > 0 ? '+' : change < 0 ? '−' : ''
  return `${sign}${percentFormatter.format(Math.abs(change))}%`
}

export function shortBranchName(name: string): string {
  return name.replace(/^intelligent nutrition\s*[-–—]\s*/i, '').trim() || name
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

export function daysUntil(isoDate: string, today: string): number {
  return Math.round((toUtcDate(isoDate).getTime() - toUtcDate(today).getTime()) / DAY_MS)
}

export function alertDescription(alert: DashboardAlert, today: string): string {
  const where = joinNames(alert.branches.map((branch) => shortBranchName(branch.name)))
  switch (alert.type) {
    case 'OUT_OF_STOCK':
      return `Agotado en ${where}`
    case 'LAST_UNIT':
      return `Última unidad en ${where}`
    case 'BELOW_MINIMUM':
      return `Por debajo del mínimo en ${where}`
    case 'EXPIRING': {
      if (!alert.expirationDate) return `Vence pronto en ${where}`
      const days = daysUntil(alert.expirationDate, today)
      const when = days <= 0 ? 'Vence hoy' : days === 1 ? 'Vence mañana' : `Vence en ${days} días`
      return `${when}, lote del ${formatExpirationDate(alert.expirationDate)}`
    }
  }
}

export interface AlertAction {
  label: string
  to: string
}

const ALERT_ACTIONS: Record<DashboardAlertType, AlertAction> = {
  OUT_OF_STOCK: { label: 'Pedir', to: '/proveedores/compras' },
  BELOW_MINIMUM: { label: 'Pedir', to: '/proveedores/compras' },
  LAST_UNIT: { label: 'Trasladar', to: '/inventario/movimientos' },
  EXPIRING: { label: 'Promover', to: '/promociones' },
}

export function alertAction(type: DashboardAlertType): AlertAction {
  return ALERT_ACTIONS[type]
}

export function isUrgentAlert(type: DashboardAlertType): boolean {
  return type === 'OUT_OF_STOCK'
}

export function resolveDashboardError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case 'BRANCH_NOT_FOUND':
      return 'La sede elegida ya no existe. Elige otra.'
    case 'BRANCH_SCOPE_VIOLATION':
      return 'No tienes acceso a esta sede.'
  }
  if (error.status === 403) return 'No tienes permiso para ver estos indicadores.'
  return fallback
}

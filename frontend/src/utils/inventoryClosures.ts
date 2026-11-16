import { ApiError } from '../services/http'
import type { RoleName } from '../types/auth'
import type { ClosureItem, ClosureStatus } from '../types/inventoryClosure'

export const CLOSURE_COUNT_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT']
export const CLOSURE_REVIEW_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER']
export const CLOSURE_OBSERVATION_MAX_LENGTH = 500

export const CLOSURE_STATUS_LABELS: Record<ClosureStatus, string> = {
  PENDING: 'En conteo',
  CONFIRMED: 'Confirmado',
  NOT_CONFIRMED: 'Sin confirmar',
}

export const CLOSURE_STATUS_TONES: Record<ClosureStatus, string> = {
  PENDING: 'pendiente',
  CONFIRMED: 'activo',
  NOT_CONFIRMED: 'inactivo',
}

const BUSINESS_TIME_ZONE = 'America/Bogota'

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function businessToday(now: Date = new Date()): string {
  return businessDateFormatter.format(now)
}

const longDateFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

export function formatClosureDay(isoDate: string): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return isoDate
  return longDateFormatter.format(date)
}

export function lotKey(item: Pick<ClosureItem, 'productId' | 'expirationDate'>): string {
  return `${item.productId}|${item.expirationDate ?? ''}`
}

export const COUNT_PATTERN = /^\d{1,9}$/

export function countError(value: string): string | null {
  if (value.trim() === '') return null
  return COUNT_PATTERN.test(value.trim())
    ? null
    : 'Escribe un número entero de 0 en adelante, sin puntos ni comas.'
}

const SUPPLY_COUNT_PATTERN = /^\d{1,9}([.,]\d{1,3})?$/

export function supplyCountError(value: string): string | null {
  if (value.trim() === '') return null
  return SUPPLY_COUNT_PATTERN.test(value.trim())
    ? null
    : 'Escribe un número de 0 en adelante, con máximo 3 decimales.'
}

export function parseSupplyCount(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

export function supplyKey(supplyId: string): string {
  return `supply:${supplyId}`
}

const supplyDifferenceFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 })

export function supplyDifferenceLabel(difference: string | null | undefined, unit: string): string {
  if (difference === null || difference === undefined) return '—'
  const value = Number(difference)
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return 'Sin diferencia'
  const sign = value > 0 ? '+' : '−'
  return `${sign}${supplyDifferenceFormatter.format(Math.abs(value))} ${unit}`
}

export function differenceLabel(difference: number | null | undefined, unit: string): string {
  if (difference === null || difference === undefined) return '—'
  if (difference === 0) return 'Sin diferencia'
  const sign = difference > 0 ? '+' : '−'
  return `${sign}${new Intl.NumberFormat('es-CO').format(Math.abs(difference))} ${unit}`
}

export function resolveClosureError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case 'CLOSURE_ALREADY_EXISTS':
      return 'La sede ya tiene un cierre para hoy. Recarga para continuar con ese conteo.'
    case 'CLOSURE_LOCKED':
      return 'El cierre ya se confirmó o se bloqueó: los conteos no se pueden cambiar. Si hay una diferencia, el superadmin puede registrar un ajuste.'
    case 'INCOMPLETE_COUNT':
      return 'Faltan lotes o insumos por contar. Escribe la cantidad de cada uno antes de confirmar.'
    case 'PRODUCT_NOT_IN_CLOSURE':
      return 'Uno de los lotes ya no pertenece al cierre. Recarga la página.'
    case 'BRANCH_INACTIVE':
      return 'La sede está inactiva: no se puede iniciar el cierre.'
    case 'BRANCH_SCOPE_VIOLATION':
      return 'No tienes acceso a esta sede.'
    case 'BRANCH_REQUIRED':
      return 'Elige una sede para ver sus cierres.'
    case 'CLOSURE_NOT_FOUND':
      return 'El cierre ya no existe. Recarga la página.'
    case 'SUPPLY_NOT_IN_CLOSURE':
      return 'Uno de los insumos ya no pertenece al cierre. Recarga la página.'
    case 'ACTIVE_CASH_SHIFT_REQUIRED':
      return 'La sede no tiene un turno de caja abierto. Abre un turno en Caja antes de confirmar el cierre.'
    case 'CASH_SHIFT_NOT_ACTIVE':
      return 'El turno de caja ya se cerró. Recarga la página para ver el turno activo.'
  }
  if (error.status === 403) return 'No tienes permiso para realizar esta acción.'
  if (error.status === 400) return 'Revisa los datos: hay un valor que el servidor no aceptó.'
  return fallback
}

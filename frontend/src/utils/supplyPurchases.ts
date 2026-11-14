import { ApiError } from '../services/http'
import type { SupplyPurchaseStatus } from '../types/supplyPurchase'

export const SUPPLY_PURCHASE_STATUS_LABELS: Record<SupplyPurchaseStatus, string> = {
  PENDING_RECEIPT: 'Pendiente de recibir',
  PARTIALLY_RECEIVED: 'Recibida en parte',
  FULLY_RECEIVED: 'Recibida',
}

export const SUPPLY_PURCHASE_STATUS_TONES: Record<
  SupplyPurchaseStatus,
  'activo' | 'pendiente' | 'inactivo'
> = {
  PENDING_RECEIPT: 'pendiente',
  PARTIALLY_RECEIVED: 'pendiente',
  FULLY_RECEIVED: 'activo',
}

const quantityFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 })

export function formatSupplyQuantity(quantity: number, unit: string): string {
  return `${quantityFormatter.format(quantity)} ${unit}`
}

export function parseQuantity(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) return null
  const quantity = Number(normalized)
  return quantity > 0 ? quantity : null
}

export function lineSubtotalCents(quantity: number, unitCost: string): number {
  return Math.round((Math.round(Number(unitCost) * 100) * Math.round(quantity * 1000)) / 1000)
}

export function resolveSupplyPurchaseError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case 'DUPLICATED_SUPPLY':
      return 'Cada insumo solo puede ir una vez en la compra.'
    case 'SUPPLIER_INACTIVE':
      return 'El proveedor está inactivo.'
    case 'SUPPLY_INACTIVE':
      return 'Uno de los insumos está inactivo.'
    case 'QUANTITY_EXCEEDS_PENDING':
      return 'Una de las cantidades supera lo que falta por recibir.'
    case 'PURCHASE_ALREADY_RECEIVED':
      return 'La compra ya se recibió completa.'
    case 'BRANCH_SCOPE_VIOLATION':
      return 'Solo puedes recibir en tus sedes.'
    case 'BRANCH_INACTIVE':
      return 'La sede está inactiva.'
    default:
      return error.message || fallback
  }
}

import { z } from 'zod'

import { ApiError } from '../services/http'
import type { RoleName } from '../types/auth'
import type { Promotion } from '../types/promotion'
import type { DiscountChoice, PaymentDraft, SaleStatus } from '../types/sale'

import { formatPercentage } from './promotions'

export const SALE_REGISTER_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT']
export const SALE_REVERSE_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT']
export const REVERSAL_REASON_MIN_LENGTH = 10
export const REVERSAL_REASON_MAX_LENGTH = 500

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  COMPLETED: 'Completada',
  REVERSED: 'Reversada',
}

export const SALE_STATUS_TONES: Record<SaleStatus, string> = {
  COMPLETED: 'activo',
  REVERSED: 'inactivo',
}

export const reverseSaleSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(
      REVERSAL_REASON_MIN_LENGTH,
      `Explica el motivo con al menos ${REVERSAL_REASON_MIN_LENGTH} caracteres.`,
    )
    .max(REVERSAL_REASON_MAX_LENGTH, 'El motivo no puede superar 500 caracteres.'),
})

export type ReverseSaleValues = z.infer<typeof reverseSaleSchema>

export function toCents(value: string | number): number {
  return Math.round(Number(value) * 100)
}

export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function selectionTotalCents(
  lines: { product: { price: string }; quantity: number }[],
): number {
  return lines.reduce((sum, line) => sum + toCents(line.product.price) * line.quantity, 0)
}

export function promotionDiscountCents(
  subtotalCents: number,
  discountPercentage: string | null | undefined,
): number {
  if (!discountPercentage) return 0
  return Math.round((subtotalCents * Number(discountPercentage)) / 100)
}

export const DISCOUNT_REASON_MAX_LENGTH = 200

const PERCENTAGE_PATTERN = /^\d{1,3}([.,]\d{1,2})?$/

export interface ResolvedDiscount {
  kind: DiscountChoice['kind']
  cents: number
  label: string | null
  promotion: Promotion | null
  needsPromotions: boolean
  valueError: string | null
  reasonError: string | null
  promotionError: string | null
  payload: { promotionId: string | null; discountAmount?: string; discountReason?: string }
}

export function resolveDiscount(
  choice: DiscountChoice | null,
  promotions: Promotion[],
  subtotalCents: number,
): ResolvedDiscount {
  const base = {
    cents: 0,
    label: null,
    promotion: null,
    valueError: null,
    reasonError: null,
    promotionError: null,
  }
  const effective: DiscountChoice =
    choice ??
    (() => {
      const active = promotions.find((promotion) => promotion.active)
      return active ? { kind: 'promotion', promotionId: active.id } : { kind: 'none' }
    })()

  if (effective.kind === 'none') {
    return {
      ...base,
      kind: 'none',
      needsPromotions: choice === null,
      payload: { promotionId: null },
    }
  }

  if (effective.kind === 'promotion') {
    const promotion = promotions.find((item) => item.id === effective.promotionId) ?? null
    if (!promotion) {
      return {
        ...base,
        kind: 'promotion',
        needsPromotions: true,
        promotionError: 'La promoción elegida ya no está vigente. Elige otro descuento.',
        payload: { promotionId: effective.promotionId },
      }
    }
    return {
      ...base,
      kind: 'promotion',
      needsPromotions: true,
      cents: promotionDiscountCents(subtotalCents, promotion.discountPercentage),
      label: `Promoción ${promotion.name} (${formatPercentage(promotion.discountPercentage)})`,
      promotion,
      payload: { promotionId: promotion.id },
    }
  }

  const reason = effective.reason.trim()
  const reasonError = reason ? null : 'Escribe el motivo del descuento.'
  let cents = 0
  let valueError: string | null = null
  let label = 'Descuento personalizado'
  if (effective.type === 'percentage') {
    const text = effective.value.trim()
    const percentage = Number(text.replace(',', '.'))
    if (!PERCENTAGE_PATTERN.test(text) || percentage <= 0 || percentage > 100) {
      valueError = 'Escribe un porcentaje mayor que 0 y máximo 100.'
    } else {
      cents = Math.round((subtotalCents * percentage) / 100)
      label = `Descuento personalizado (${formatPercentage(percentage)})`
    }
  } else {
    const amount = parseAmountCents(effective.value)
    if (amount === null || amount <= 0) {
      valueError = 'Escribe un valor mayor que 0, por ejemplo 10.000.'
    } else if (amount > subtotalCents) {
      valueError = 'El descuento no puede superar el subtotal de la venta.'
    } else {
      cents = amount
    }
  }
  const valid = !valueError && !reasonError
  return {
    ...base,
    kind: 'custom',
    needsPromotions: false,
    cents: valid ? cents : 0,
    label,
    valueError,
    reasonError,
    payload: valid
      ? { promotionId: null, discountAmount: centsToAmount(cents), discountReason: reason }
      : { promotionId: null },
  }
}

export function discountReady(discount: ResolvedDiscount): boolean {
  return !discount.valueError && !discount.reasonError && !discount.promotionError
}

export const PAYMENT_REFERENCE_MAX_LENGTH = 100

let paymentDraftSequence = 0

export function createPaymentDraft(paymentMethodId = '', amount = ''): PaymentDraft {
  paymentDraftSequence += 1
  return { id: `payment-${paymentDraftSequence}`, paymentMethodId, amount, reference: '' }
}

const THOUSANDS_PATTERN = /^\d{1,3}(\.\d{3})+$/
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

export function parseAmountCents(text: string): number | null {
  let value = text.replace(/[\s$]/g, '')
  if (!value) return null
  if (value.includes(',')) value = value.replace(/\./g, '').replace(',', '.')
  else if (THOUSANDS_PATTERN.test(value)) value = value.replace(/\./g, '')
  if (!AMOUNT_PATTERN.test(value)) return null
  return toCents(value)
}

export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')
}

export interface PaymentsBalance {
  amounts: (number | null)[]
  assignedCents: number
  differenceCents: number
  complete: boolean
  matches: boolean
}

export function paymentsBalance(
  payments: { amount: string }[],
  totalCents: number,
): PaymentsBalance {
  const amounts =
    payments.length === 1
      ? [totalCents]
      : payments.map((payment) => {
          const cents = parseAmountCents(payment.amount)
          return cents !== null && cents > 0 ? cents : null
        })
  const assignedCents = amounts.reduce<number>((sum, cents) => sum + (cents ?? 0), 0)
  const complete = amounts.every((cents) => cents !== null)
  const differenceCents = totalCents - assignedCents
  return {
    amounts,
    assignedCents,
    differenceCents,
    complete,
    matches: complete && differenceCents === 0,
  }
}

export interface StockShortage {
  productName: string
  requested: number
  available: number
}

export function stockShortages(error: unknown): StockShortage[] {
  if (!(error instanceof ApiError) || error.code !== 'INSUFFICIENT_STOCK') return []
  const details = error.details as { items?: StockShortage[] } | undefined
  return details?.items ?? []
}

export function resolveSaleError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case 'INSUFFICIENT_STOCK':
      return 'Ya no hay unidades suficientes de algunos productos. Ajusta las cantidades de la venta.'
    case 'PAYMENT_TOTAL_MISMATCH':
      return 'El total cambió porque se actualizó un precio o la promoción activa. Revisa el total y vuelve a intentar.'
    case 'PROMOTION_NOT_APPLICABLE':
      return 'La promoción elegida ya no está vigente. Elige otro descuento.'
    case 'DISCOUNT_EXCEEDS_SUBTOTAL':
      return 'El descuento no puede superar el subtotal de la venta.'
    case 'INVENTORY_CLOSED':
      return 'El inventario de la sede ya se cerró hoy: no se pueden registrar más ventas hasta mañana.'
    case 'PAYMENT_METHOD_INACTIVE':
    case 'PAYMENT_METHOD_NOT_FOUND':
      return 'El método de pago ya no está disponible. Elige otro.'
    case 'PRODUCT_INACTIVE':
    case 'PRODUCT_NOT_FOUND':
      return 'Uno de los productos ya no se puede vender. Quítalo de la venta y vuelve a intentar.'
    case 'BRANCH_INACTIVE':
      return 'La sede está inactiva: no puede registrar ventas.'
    case 'SALE_ALREADY_REVERSED':
      return 'Esta venta ya fue reversada. Recarga el listado para ver su estado.'
    case 'SALE_DAY_CLOSED':
      return 'El inventario del día de esta venta ya se cerró, así que no se puede reversar. El superadmin puede corregirlo con un ajuste en Movimientos.'
    case 'SALE_NOT_FOUND':
      return 'La venta ya no existe. Recarga el listado.'
    case 'SALE_REVERSAL_NO_INVENTORY':
      return 'Uno de los productos ya no está asignado a la sede, así que no se puede devolver su stock.'
    case 'BRANCH_SCOPE_VIOLATION':
      return 'No tienes acceso a esta sede.'
    case 'BRANCH_REQUIRED':
      return 'Elige una sede para ver sus ventas.'
    case 'BRANCH_NOT_FOUND':
      return 'La sede ya no existe. Recarga la página.'
  }
  if (error.status === 403) return 'No tienes permiso para realizar esta acción.'
  if (error.status === 400) return 'Revisa los datos: hay un valor que el servidor no aceptó.'
  return fallback
}

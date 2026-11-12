import { z } from 'zod'

import { ApiError } from '../services/http'
import type { RoleName } from '../types/auth'
import type { Promotion } from '../types/promotion'

import { formatExpirationDate } from './inventory'

export const PROMOTION_MANAGE_ROLES: RoleName[] = ['SUPERADMIN']
export const PROMOTION_NAME_MIN_LENGTH = 2
export const PROMOTION_NAME_MAX_LENGTH = 100

const PERCENTAGE_PATTERN = /^\d{1,3}([.,]\d{1,2})?$/

function percentageValue(text: string): number {
  return Number(text.trim().replace(',', '.'))
}

export function toPercentageString(text: string): string {
  return percentageValue(text).toFixed(2)
}

export function formatPercentage(value: string | number): string {
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(Number(value))} %`
}

export const promotionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Escribe el nombre de la promoción.')
      .min(
        PROMOTION_NAME_MIN_LENGTH,
        `El nombre debe tener al menos ${PROMOTION_NAME_MIN_LENGTH} caracteres.`,
      )
      .max(
        PROMOTION_NAME_MAX_LENGTH,
        `El nombre no puede superar ${PROMOTION_NAME_MAX_LENGTH} caracteres.`,
      ),
    discountPercentage: z
      .string()
      .trim()
      .min(1, 'Escribe el porcentaje de descuento.')
      .regex(
        PERCENTAGE_PATTERN,
        'Escribe un porcentaje con máximo 2 decimales, por ejemplo 15 o 12,5.',
      )
      .refine((value) => {
        const percentage = percentageValue(value)
        return percentage > 0 && percentage <= 100
      }, 'El descuento debe ser mayor que 0 y máximo 100.'),
    startDate: z.string(),
    endDate: z.string(),
  })
  .superRefine((values, context) => {
    if (values.startDate && values.endDate && values.startDate > values.endDate) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'La fecha final debe ser igual o posterior a la fecha inicial.',
      })
    }
  })

export type PromotionFormValues = z.infer<typeof promotionSchema>

export function promotionPeriod(promotion: Pick<Promotion, 'startDate' | 'endDate'>): string {
  const { startDate, endDate } = promotion
  if (startDate && endDate) {
    return `${formatExpirationDate(startDate)} – ${formatExpirationDate(endDate)}`
  }
  if (startDate) return `Desde el ${formatExpirationDate(startDate)}`
  if (endDate) return `Hasta el ${formatExpirationDate(endDate)}`
  return 'Sin fechas'
}

export function isOutsidePeriod(
  promotion: Pick<Promotion, 'startDate' | 'endDate'>,
  now: Date = new Date(),
): boolean {
  const today = now.toISOString().slice(0, 10)
  return (
    (promotion.startDate !== null && promotion.startDate > today) ||
    (promotion.endDate !== null && promotion.endDate < today)
  )
}

export type PromotionErrorField = 'name' | 'startDate'

export function promotionFieldError(
  error: unknown,
): { field: PromotionErrorField; message: string } | null {
  if (!(error instanceof ApiError)) return null
  if (error.code === 'PROMOTION_NAME_ALREADY_EXISTS') {
    return { field: 'name', message: 'Ya existe una promoción con ese nombre. Usa otro.' }
  }
  if (error.code === 'PROMOTION_DATE_RANGE_OVERLAP') {
    return {
      field: 'startDate',
      message:
        'Las fechas se cruzan con las de otra promoción. Cambia el rango; una promoción sin fechas se cruza con todas.',
    }
  }
  return null
}

export function resolvePromotionError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  const fieldError = promotionFieldError(error)
  if (fieldError) return fieldError.message
  switch (error.code) {
    case 'PROMOTION_IS_ACTIVE':
      return 'La promoción está activa. Desactívala antes de editarla.'
    case 'PROMOTION_ALREADY_ACTIVE':
      return 'Ya hay otra promoción activa. Desactívala primero.'
    case 'ALREADY_IN_STATE':
      return 'La promoción ya tenía ese estado. Recarga el listado para ver su estado actual.'
    case 'NOT_FOUND':
      return 'Esta promoción ya no existe. Recarga el listado.'
  }
  if (error.status === 403) return 'Solo el superadmin puede gestionar las promociones.'
  if (error.status === 404) return 'Esta promoción ya no existe. Recarga el listado.'
  if (error.status === 400) return 'Revisa los datos: hay un valor que el servidor no aceptó.'
  return fallback
}

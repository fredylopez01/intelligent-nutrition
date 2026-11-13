import { z } from 'zod'

import { ApiError } from '../services/http'
import type { RoleName } from '../types/auth'
import type { SupplyStockRow } from '../types/supply'

export const SUPPLY_MANAGE_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER']
export const SUPPLY_MINIMUM_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER']
export const SUPPLY_MOVEMENT_ROLES: RoleName[] = ['BRANCH_LEADER', 'BRANCH_ASSISTANT']
export const SUPPLY_NAME_MIN_LENGTH = 2
export const SUPPLY_NAME_MAX_LENGTH = 150
export const SUPPLY_OBSERVATION_MAX_LENGTH = 500

const quantityFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 })

export function supplyQuantity(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatSupplyQuantity(value: string | number, unit?: string): string {
  const text = quantityFormatter.format(supplyQuantity(value))
  return unit ? `${text} ${unit}` : text
}

export function isSupplyLow(row: Pick<SupplyStockRow, 'quantity' | 'minimumQuantity'>): boolean {
  return supplyQuantity(row.quantity) < supplyQuantity(row.minimumQuantity)
}

export const supplySchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      SUPPLY_NAME_MIN_LENGTH,
      `El nombre debe tener al menos ${SUPPLY_NAME_MIN_LENGTH} caracteres.`,
    )
    .max(
      SUPPLY_NAME_MAX_LENGTH,
      `El nombre no puede superar los ${SUPPLY_NAME_MAX_LENGTH} caracteres.`,
    ),
  unitOfMeasureId: z.string().min(1, 'Elige la unidad de medida.'),
})

export type SupplyFormValues = z.infer<typeof supplySchema>

const WHOLE_PATTERN = /^\d{1,9}$/

export function buildMovementSchema(available: number, unit: string) {
  return z
    .object({
      movementType: z.enum(['ENTRY', 'EXIT']),
      quantity: z
        .string()
        .trim()
        .min(1, 'Escribe la cantidad.')
        .refine(
          (value) => WHOLE_PATTERN.test(value) && Number(value) > 0,
          'Usa un número entero mayor que 0.',
        ),
      observation: z
        .string()
        .trim()
        .max(
          SUPPLY_OBSERVATION_MAX_LENGTH,
          `El motivo no puede superar los ${SUPPLY_OBSERVATION_MAX_LENGTH} caracteres.`,
        ),
    })
    .superRefine((values, context) => {
      if (values.movementType !== 'EXIT') return
      if (!values.observation) {
        context.addIssue({
          code: 'custom',
          path: ['observation'],
          message: 'Escribe el motivo de la salida.',
        })
      }
      if (WHOLE_PATTERN.test(values.quantity) && Number(values.quantity) > available) {
        context.addIssue({
          code: 'custom',
          path: ['quantity'],
          message: `Solo hay ${formatSupplyQuantity(available, unit)} disponibles. No puedes sacar más.`,
        })
      }
    })
}

export type SupplyMovementValues = z.infer<ReturnType<typeof buildMovementSchema>>

const MINIMUM_PATTERN = /^\d{1,9}([.,]\d{1,3})?$/

export function parseMinimum(text: string): number | null {
  const value = text.trim()
  if (!MINIMUM_PATTERN.test(value)) return null
  return Number(value.replace(',', '.'))
}

export const supplyMinimumSchema = z.object({
  minimumQuantity: z
    .string()
    .trim()
    .min(1, 'Escribe el stock mínimo.')
    .refine(
      (value) => parseMinimum(value) !== null,
      'Usa un número igual o mayor que 0 con máximo 3 decimales.',
    ),
})

export type SupplyMinimumValues = z.infer<typeof supplyMinimumSchema>

export function resolveSupplyError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case 'SUPPLY_NAME_ALREADY_EXISTS':
      return 'Ya existe un insumo con ese nombre.'
    case 'UNIT_INACTIVE':
      return 'La unidad de medida está inactiva. Elige otra.'
    case 'INSUFFICIENT_SUPPLY_STOCK':
      return 'No hay stock suficiente para esa salida. Recarga la lista para ver la cantidad actual.'
    case 'SUPPLY_NOT_ASSIGNED':
      return 'El insumo no está asignado a esta sede.'
    case 'SUPPLY_NOT_FOUND':
      return 'El insumo ya no existe. Recarga la lista.'
    case 'SUPPLY_INACTIVE':
      return 'El insumo está inactivo.'
    case 'BRANCH_INACTIVE':
      return 'La sede está inactiva.'
    case 'BRANCH_SCOPE_VIOLATION':
      return 'No tienes acceso a esta sede.'
  }
  if (error.status === 403) return 'Tu rol no puede hacer esta acción con los insumos.'
  if (error.status === 400) return 'Revisa los datos: hay un valor que el servidor no aceptó.'
  return fallback
}

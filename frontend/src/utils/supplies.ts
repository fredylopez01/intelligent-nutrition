import { z } from 'zod'

import { ApiError } from '../services/http'
import type { RoleName } from '../types/auth'
import type { SupplyStockRow } from '../types/supply'

export const SUPPLY_MANAGE_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER']
export const SUPPLY_MINIMUM_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER']
export const SUPPLY_MOVEMENT_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT']
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

export const supplySchema = z
  .object({
    name: z.string().trim(),
    unitOfMeasureId: z.string().min(1, 'Elige la unidad de medida.'),
    linked: z.boolean(),
    productUnitQuantity: z.string(),
  })
  .superRefine((values, context) => {
    if (!values.linked) {
      if (values.name.length < SUPPLY_NAME_MIN_LENGTH) {
        context.addIssue({
          code: 'custom',
          path: ['name'],
          message: `El nombre debe tener al menos ${SUPPLY_NAME_MIN_LENGTH} caracteres.`,
        })
      } else if (values.name.length > SUPPLY_NAME_MAX_LENGTH) {
        context.addIssue({
          code: 'custom',
          path: ['name'],
          message: `El nombre no puede superar los ${SUPPLY_NAME_MAX_LENGTH} caracteres.`,
        })
      }
      return
    }
    if (!values.productUnitQuantity.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['productUnitQuantity'],
        message: 'Escribe cuánto rinde una unidad del producto.',
      })
      return
    }
    if (parseUnitQuantity(values.productUnitQuantity) === null) {
      context.addIssue({
        code: 'custom',
        path: ['productUnitQuantity'],
        message: 'Usa un número mayor que 0 con máximo 3 decimales.',
      })
    }
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

export const CONVERSION_MAX_UNITS = 100

export function productUnitsLabel(units: number): string {
  return units === 1 ? '1 unidad' : `${units} unidades`
}

export function parseUnitQuantity(text: string): number | null {
  const value = parseMinimum(text)
  return value !== null && value > 0 ? value : null
}

export const unitQuantityField = z
  .string()
  .trim()
  .min(1, 'Escribe cuánto rinde una unidad del producto.')
  .refine(
    (value) => parseUnitQuantity(value) !== null,
    'Usa un número mayor que 0 con máximo 3 decimales.',
  )

export const supplyLinkSchema = z.object({ productUnitQuantity: unitQuantityField })

export type SupplyLinkValues = z.infer<typeof supplyLinkSchema>

export const conversionSchema = z.object({
  productUnits: z
    .string()
    .trim()
    .min(1, 'Escribe cuántas unidades vas a abrir.')
    .refine(
      (value) =>
        WHOLE_PATTERN.test(value) && Number(value) > 0 && Number(value) <= CONVERSION_MAX_UNITS,
      `Usa un número entero entre 1 y ${CONVERSION_MAX_UNITS}.`,
    ),
  observation: z
    .string()
    .trim()
    .max(
      SUPPLY_OBSERVATION_MAX_LENGTH,
      `La nota no puede superar los ${SUPPLY_OBSERVATION_MAX_LENGTH} caracteres.`,
    ),
})

export type ConversionValues = z.infer<typeof conversionSchema>

type ContentFamily = 'mass' | 'volume' | 'capsule' | 'serving' | 'unit'

interface ContentUnit {
  family: ContentFamily
  factor: number
  metric: boolean
}

const CONTENT_UNITS: Record<string, ContentUnit> = {
  g: { family: 'mass', factor: 1, metric: true },
  gr: { family: 'mass', factor: 1, metric: true },
  grs: { family: 'mass', factor: 1, metric: true },
  gramo: { family: 'mass', factor: 1, metric: true },
  gramos: { family: 'mass', factor: 1, metric: true },
  kg: { family: 'mass', factor: 1000, metric: true },
  kilo: { family: 'mass', factor: 1000, metric: true },
  kilos: { family: 'mass', factor: 1000, metric: true },
  lb: { family: 'mass', factor: 453.592, metric: false },
  lbs: { family: 'mass', factor: 453.592, metric: false },
  libra: { family: 'mass', factor: 453.592, metric: false },
  libras: { family: 'mass', factor: 453.592, metric: false },
  oz: { family: 'mass', factor: 28.3495, metric: false },
  ml: { family: 'volume', factor: 1, metric: true },
  l: { family: 'volume', factor: 1000, metric: true },
  lt: { family: 'volume', factor: 1000, metric: true },
  litro: { family: 'volume', factor: 1000, metric: true },
  litros: { family: 'volume', factor: 1000, metric: true },
  cap: { family: 'capsule', factor: 1, metric: true },
  caps: { family: 'capsule', factor: 1, metric: true },
  capsula: { family: 'capsule', factor: 1, metric: true },
  capsulas: { family: 'capsule', factor: 1, metric: true },
  serv: { family: 'serving', factor: 1, metric: true },
  servicio: { family: 'serving', factor: 1, metric: true },
  servicios: { family: 'serving', factor: 1, metric: true },
  und: { family: 'unit', factor: 1, metric: true },
  unidad: { family: 'unit', factor: 1, metric: true },
  unidades: { family: 'unit', factor: 1, metric: true },
}

const SUPPLY_UNITS: Record<string, { family: ContentFamily; factor: number }> = {
  g: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  ml: { family: 'volume', factor: 1 },
  l: { family: 'volume', factor: 1000 },
  cap: { family: 'capsule', factor: 1 },
  serv: { family: 'serving', factor: 1 },
  und: { family: 'unit', factor: 1 },
}

const CONTENT_PATTERN =
  /(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(kg|kilos?|gramos?|grs?|g|lbs?|libras?|oz|ml|litros?|lt|l|c[aá]psulas?|caps?|servicios?|serv|und|unidad(?:es)?)(?![\p{L}\d])/giu

interface ProductContent {
  text: string
  amount: number
  unit: ContentUnit
}

function readContents(productName: string): ProductContent[] {
  return [...productName.matchAll(CONTENT_PATTERN)].flatMap((match) => {
    const unit =
      CONTENT_UNITS[
        match[2]
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      ]
    const amount = Number(match[1].replace(',', '.'))
    return unit && amount > 0 ? [{ text: match[0], amount, unit }] : []
  })
}

export type YieldSuggestion =
  | { kind: 'match'; quantity: number; text: string; converted: boolean }
  | { kind: 'mismatch'; text: string }

export function suggestProductYield(
  productName: string,
  supplyUnit: string | undefined,
): YieldSuggestion | null {
  const target = supplyUnit ? SUPPLY_UNITS[supplyUnit.toLowerCase()] : undefined
  const contents = readContents(productName)
  if (!target || contents.length === 0) return null
  const content = contents.find((item) => item.unit.family === target.family)
  if (!content) return { kind: 'mismatch', text: contents[0].text }
  const raw = (content.amount * content.unit.factor) / target.factor
  const quantity =
    !content.unit.metric && raw >= 10 ? Math.round(raw) : Math.round(raw * 1000) / 1000
  return {
    kind: 'match',
    quantity,
    text: content.text,
    converted: content.unit.factor !== target.factor,
  }
}

export function yieldWarning(
  productName: string,
  supplyUnit: string | undefined,
  value: string,
): string | null {
  const suggestion = suggestProductYield(productName, supplyUnit)
  if (!suggestion || !supplyUnit) return null
  if (suggestion.kind === 'mismatch') {
    return `El producto dice ${suggestion.text} y el insumo se mide en ${supplyUnit}. Revisa la unidad.`
  }
  const entered = parseUnitQuantity(value)
  if (entered === null) return null
  if (Math.abs(entered - suggestion.quantity) <= suggestion.quantity * 0.02) return null
  const equivalent = suggestion.converted
    ? ` (≈ ${formatSupplyQuantity(suggestion.quantity, supplyUnit)})`
    : ''
  return `El producto dice ${suggestion.text}${equivalent} y escribiste ${formatSupplyQuantity(entered, supplyUnit)}. Revisa el rendimiento.`
}

export function guessSupplyUnit(productName: string): string | null {
  const content = readContents(productName)[0]
  if (!content) return null
  const byFamily: Record<ContentFamily, string> = {
    mass: 'g',
    volume: 'ml',
    capsule: 'cap',
    serving: 'serv',
    unit: 'und',
  }
  return byFamily[content.unit.family]
}

interface LinkedProductDetails {
  supplyName?: string
  supplyActive?: boolean
  recipeName?: string
}

function errorDetails(error: ApiError): LinkedProductDetails {
  return typeof error.details === 'object' && error.details !== null
    ? (error.details as LinkedProductDetails)
    : {}
}

export function resolveSupplyError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case 'PRODUCT_ALREADY_LINKED': {
      const { supplyName, supplyActive } = errorDetails(error)
      const name = supplyName ? `el insumo «${supplyName}»` : 'otro insumo'
      return supplyActive === false
        ? `Ese producto ya es ${name}, que está inactivo. Actívalo en Inventario › Insumos.`
        : `Ese producto ya es ${name}. Úsalo en lugar de crear otro.`
    }
    case 'PRODUCT_IS_PREPARED': {
      const { recipeName } = errorDetails(error)
      return `Ese producto se prepara con ${recipeName ? `la receta «${recipeName}»` : 'una receta'}, así que no puede ser un insumo.`
    }
    case 'SUPPLY_NAME_FROM_PRODUCT':
      return 'El nombre de este insumo sigue al del producto. Cámbialo en el catálogo.'
    case 'SUPPLY_NAME_REQUIRED':
      return 'Escribe el nombre del insumo.'

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
    case 'SUPPLY_NOT_LINKED':
      return 'El insumo no está ligado a un producto del catálogo.'
    case 'PRODUCT_NOT_FOUND':
      return 'El producto ya no existe en el catálogo. Elige otro.'
    case 'PRODUCT_INACTIVE':
      return 'El producto está inactivo en el catálogo.'
    case 'INSUFFICIENT_STOCK':
      return 'La sede no tiene suficientes unidades vigentes del producto. Recarga para ver lo disponible.'
  }
  if (error.status === 403) return 'Tu rol no puede hacer esta acción con los insumos.'
  if (error.status === 400) return 'Revisa los datos: hay un valor que el servidor no aceptó.'
  return fallback
}

import { describe, expect, it } from 'vitest'

import { ApiError } from '../services/http'

import {
  formatPercentage,
  isOutsidePeriod,
  promotionFieldError,
  promotionPeriod,
  promotionSchema,
  resolvePromotionError,
  toPercentageString,
} from './promotions'

const valid = { name: 'Black Friday', discountPercentage: '15', startDate: '', endDate: '' }

function firstIssue(values: typeof valid) {
  const result = promotionSchema.safeParse(values)
  return result.success ? null : result.error.issues[0]
}

describe('promotion percentages', () => {
  it('sends the percentage with two decimals and accepts a decimal comma', () => {
    expect(toPercentageString('15')).toBe('15.00')
    expect(toPercentageString('12,5')).toBe('12.50')
  })

  it('formats the percentage for Colombia', () => {
    expect(formatPercentage('20.50')).toBe('20,5 %')
    expect(formatPercentage('15.00')).toBe('15 %')
  })
})

describe('promotionSchema', () => {
  it('accepts a promotion without dates', () => {
    expect(promotionSchema.safeParse(valid).success).toBe(true)
  })

  it('requires a name of at least two characters', () => {
    expect(firstIssue({ ...valid, name: ' ' })?.message).toBe('Escribe el nombre de la promoción.')
    expect(firstIssue({ ...valid, name: 'A' })?.message).toBe(
      'El nombre debe tener al menos 2 caracteres.',
    )
  })

  it('rejects percentages outside the range or with more than two decimals', () => {
    expect(firstIssue({ ...valid, discountPercentage: '0' })?.message).toBe(
      'El descuento debe ser mayor que 0 y máximo 100.',
    )
    expect(firstIssue({ ...valid, discountPercentage: '100.01' })?.message).toBe(
      'El descuento debe ser mayor que 0 y máximo 100.',
    )
    expect(firstIssue({ ...valid, discountPercentage: '12.345' })?.path).toEqual([
      'discountPercentage',
    ])
  })

  it('rejects an end date before the start date', () => {
    const issue = firstIssue({ ...valid, startDate: '2026-11-30', endDate: '2026-11-01' })

    expect(issue?.path).toEqual(['endDate'])
    expect(issue?.message).toBe('La fecha final debe ser igual o posterior a la fecha inicial.')
  })

  it('accepts the same start and end date', () => {
    expect(
      promotionSchema.safeParse({ ...valid, startDate: '2026-11-27', endDate: '2026-11-27' })
        .success,
    ).toBe(true)
  })
})

describe('promotionPeriod', () => {
  it('describes each combination of dates', () => {
    expect(promotionPeriod({ startDate: '2026-11-01', endDate: '2026-11-30' })).toBe(
      '1 nov 2026 – 30 nov 2026',
    )
    expect(promotionPeriod({ startDate: '2026-11-01', endDate: null })).toBe('Desde el 1 nov 2026')
    expect(promotionPeriod({ startDate: null, endDate: '2026-11-30' })).toBe('Hasta el 30 nov 2026')
    expect(promotionPeriod({ startDate: null, endDate: null })).toBe('Sin fechas')
  })
})

describe('isOutsidePeriod', () => {
  const now = new Date('2026-11-12T15:00:00.000Z')

  it('detects a promotion that has not started or already ended', () => {
    expect(isOutsidePeriod({ startDate: '2026-12-01', endDate: null }, now)).toBe(true)
    expect(isOutsidePeriod({ startDate: null, endDate: '2026-11-11' }, now)).toBe(true)
  })

  it('treats promotions without dates or within them as current', () => {
    expect(isOutsidePeriod({ startDate: null, endDate: null }, now)).toBe(false)
    expect(isOutsidePeriod({ startDate: '2026-11-12', endDate: '2026-11-12' }, now)).toBe(false)
  })
})

describe('promotion errors', () => {
  it('maps the duplicated name and the date overlap to their fields', () => {
    expect(
      promotionFieldError(new ApiError('dup', 409, undefined, 'PROMOTION_NAME_ALREADY_EXISTS'))
        ?.field,
    ).toBe('name')
    expect(
      promotionFieldError(new ApiError('overlap', 409, undefined, 'PROMOTION_DATE_RANGE_OVERLAP'))
        ?.field,
    ).toBe('startDate')
    expect(promotionFieldError(new Error('down'))).toBeNull()
  })

  it('explains the state conflicts and permission errors', () => {
    expect(
      resolvePromotionError(new ApiError('x', 422, undefined, 'PROMOTION_IS_ACTIVE'), 'f'),
    ).toBe('La promoción está activa. Desactívala antes de editarla.')
    expect(
      resolvePromotionError(new ApiError('x', 409, undefined, 'ALREADY_IN_STATE'), 'f'),
    ).toMatch(/ya tenía ese estado/)
    expect(resolvePromotionError(new ApiError('x', 403), 'f')).toBe(
      'Solo el superadmin puede gestionar las promociones.',
    )
    expect(resolvePromotionError(new ApiError('x', 500), 'fallback')).toBe('fallback')
  })
})

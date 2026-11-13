import { describe, expect, it } from 'vitest'

import { ApiError } from '../services/http'

import {
  businessToday,
  countError,
  differenceLabel,
  formatClosureDay,
  parseSupplyCount,
  resolveClosureError,
  supplyCountError,
  supplyDifferenceLabel,
} from './inventoryClosures'

describe('inventory closure helpers', () => {
  it('uses the Bogota calendar day', () => {
    expect(businessToday(new Date('2026-10-27T03:00:00.000Z'))).toBe('2026-10-26')
    expect(businessToday(new Date('2026-10-27T05:00:00.000Z'))).toBe('2026-10-27')
  })

  it('formats the closure day with its weekday', () => {
    expect(formatClosureDay('2026-10-26')).toBe('lunes, 26 de octubre')
  })

  it.each([
    ['', null],
    ['0', null],
    ['12', null],
    ['-1', 'Escribe un número entero de 0 en adelante, sin puntos ni comas.'],
    ['1.5', 'Escribe un número entero de 0 en adelante, sin puntos ni comas.'],
    ['diez', 'Escribe un número entero de 0 en adelante, sin puntos ni comas.'],
  ])('validates the count %s', (value, error) => {
    expect(countError(value)).toBe(error)
  })

  it('labels the differences with their sign', () => {
    expect(differenceLabel(-2, 'und')).toBe('−2 und')
    expect(differenceLabel(5, 'g')).toBe('+5 g')
    expect(differenceLabel(0, 'und')).toBe('Sin diferencia')
    expect(differenceLabel(null, 'und')).toBe('—')
  })

  it('explains a locked closure', () => {
    expect(
      resolveClosureError(new ApiError('Locked', 422, {}, 'CLOSURE_LOCKED'), 'fallback'),
    ).toContain('ya se confirmó o se bloqueó')
  })

  it('validates and formats the supply counts', () => {
    expect(supplyCountError('12,5')).toBeNull()
    expect(supplyCountError('0')).toBeNull()
    expect(supplyCountError('1.2345')).toBe(
      'Escribe un número de 0 en adelante, con máximo 3 decimales.',
    )
    expect(parseSupplyCount('12,5')).toBe(12.5)
    expect(supplyDifferenceLabel('-19.5', 'ml')).toBe('−19,5 ml')
    expect(supplyDifferenceLabel('2', 'g')).toBe('+2 g')
    expect(supplyDifferenceLabel('0.000', 'g')).toBe('Sin diferencia')
    expect(supplyDifferenceLabel(null, 'g')).toBe('—')
  })

  it('explains the cash shift errors of the confirmation', () => {
    expect(
      resolveClosureError(new ApiError('x', 400, {}, 'ACTIVE_CASH_SHIFT_REQUIRED'), 'fallback'),
    ).toMatch(/turno de caja abierto/)
    expect(
      resolveClosureError(new ApiError('x', 422, {}, 'CASH_SHIFT_NOT_ACTIVE'), 'fallback'),
    ).toMatch(/turno de caja ya se cerró/)
  })
})

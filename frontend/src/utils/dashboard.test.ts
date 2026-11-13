import { describe, expect, it } from 'vitest'

import { ApiError } from '../services/http'

import {
  alertDescription,
  daysUntil,
  formatChange,
  greetingName,
  resolveDashboardError,
  salesChange,
  shortBranchName,
  todayLabel,
  weekdayLabel,
} from './dashboard'

describe('dashboard utils', () => {
  it('builds the greeting and the date of the header', () => {
    expect(greetingName('Natalia Bernal')).toBe('Natalia')
    expect(greetingName(undefined)).toBe('')
    expect(todayLabel('2026-11-12')).toBe('Jueves 12 de noviembre')
    expect(weekdayLabel('2026-11-10', '2026-11-12')).toBe('Mar')
    expect(weekdayLabel('2026-11-12', '2026-11-12')).toBe('Hoy')
  })

  it('compares the sales with yesterday', () => {
    expect(formatChange(salesChange(2418600, 2106300) ?? 0)).toBe('+14,8%')
    expect(formatChange(salesChange(50, 100) ?? 0)).toBe('−50,0%')
    expect(salesChange(100, 0)).toBeNull()
  })

  it('shortens the branch names and describes each alert', () => {
    expect(shortBranchName('Intelligent Nutrition - Medellín')).toBe('Medellín')
    expect(shortBranchName('Sede Viva')).toBe('Sede Viva')
    expect(daysUntil('2026-12-27', '2026-11-12')).toBe(45)
    const base = {
      productId: 'p',
      productName: 'Whey',
      referenceCode: 'W',
      quantity: 0,
      expirationDate: null,
    }
    expect(
      alertDescription(
        {
          ...base,
          type: 'OUT_OF_STOCK',
          branches: [
            { id: 'a', name: 'Makro' },
            { id: 'b', name: 'Viva' },
            { id: 'c', name: 'Sogamoso' },
          ],
        },
        '2026-11-12',
      ),
    ).toBe('Agotado en Makro, Viva y Sogamoso')
    expect(
      alertDescription(
        { ...base, type: 'EXPIRING', expirationDate: '2026-11-13', branches: [] },
        '2026-11-12',
      ),
    ).toBe('Vence mañana, lote del 13 nov 2026')
  })

  it('explains the known errors', () => {
    expect(
      resolveDashboardError(new ApiError('x', 404, undefined, 'BRANCH_NOT_FOUND'), 'fallback'),
    ).toBe('La sede elegida ya no existe. Elige otra.')
    expect(resolveDashboardError(new ApiError('x', 403), 'fallback')).toBe(
      'No tienes permiso para ver estos indicadores.',
    )
    expect(resolveDashboardError(new Error('boom'), 'fallback')).toBe('fallback')
  })
})

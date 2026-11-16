import { describe, expect, it } from 'vitest'

import { ApiError } from '../services/http'

import {
  alertDescription,
  averageTicket,
  daysUntil,
  formatChange,
  formatShare,
  greetingName,
  resolveDashboardError,
  salesChange,
  salesShare,
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

  it('calculates the average ticket and the share of each branch', () => {
    expect(averageTicket(150000, 2)).toBe(75000)
    expect(averageTicket(0, 0)).toBeNull()
    expect(formatShare(salesShare(1104200, 1976600))).toBe('56%')
    expect(salesShare(100, 0)).toBe(0)
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

import { describe, expect, it } from 'vitest'

import { ApiError } from '../services/http'

import { defaultReportRange, resolveReportError, shiftDate, summarizeSalesReport } from './reports'

const row = (day: string, salesCount: number, totalAmount: string) => ({
  day,
  branch: { id: 'branch-1', name: 'Centro' },
  salesCount,
  totalAmount,
})

describe('report helpers', () => {
  it('moves a calendar date across months', () => {
    expect(shiftDate('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('reports the last 30 days of Bogota by default', () => {
    expect(defaultReportRange(new Date('2026-11-13T03:00:00.000Z'))).toEqual({
      from: '2026-10-14',
      to: '2026-11-12',
    })
  })

  it('adds the total, the sales and the average ticket', () => {
    expect(
      summarizeSalesReport([row('2026-11-12', 2, '410291.00'), row('2026-11-11', 1, '0.50')]),
    ).toEqual({ totalCents: 41029150, salesCount: 3, averageCents: 13676383 })
    expect(summarizeSalesReport([])).toEqual({ totalCents: 0, salesCount: 0, averageCents: 0 })
  })

  it('explains the errors of the reports', () => {
    expect(resolveReportError(new ApiError('x', 400, undefined, 'INVALID_DATE_RANGE'), 'f')).toBe(
      'La fecha inicial debe ser anterior o igual a la fecha final.',
    )
    expect(
      resolveReportError(new ApiError('x', 403, undefined, 'BRANCH_SCOPE_VIOLATION'), 'f'),
    ).toBe('No tienes acceso a esta sede.')
    expect(resolveReportError(new ApiError('x', 403), 'f')).toMatch(/superadmin y el líder/)
    expect(resolveReportError(new Error('down'), 'fallback')).toBe('fallback')
  })
})

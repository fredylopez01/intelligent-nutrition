import { describe, expect, it } from 'vitest'

import { formatTime, scheduleDayError, scheduleStatus, summarizeSchedule } from './branchSchedule'

const lunchBreak = [
  { opensAt: '08:00', closesAt: '13:00' },
  { opensAt: '15:00', closesAt: '20:00' },
]
const schedule = [
  ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, intervals: lunchBreak })),
  { dayOfWeek: 6, intervals: [{ opensAt: '09:00', closesAt: '14:00' }] },
  { dayOfWeek: 7, intervals: [] },
]
const branch = { active: true, schedule }
const at = (iso: string) => new Date(iso)

describe('branch schedule utils', () => {
  it('formats the hours in 12 h', () => {
    expect(formatTime('08:00')).toBe('8:00 a. m.')
    expect(formatTime('13:30')).toBe('1:30 p. m.')
    expect(formatTime('00:00')).toBe('12:00 a. m.')
    expect(formatTime('12:00')).toBe('12:00 p. m.')
  })

  it('tells when the branch closes or opens again in Bogota time', () => {
    expect(scheduleStatus(branch, at('2026-11-16T14:00:00Z'))).toEqual({
      open: true,
      label: 'Abierta · cierra a las 1:00 p. m.',
    })
    expect(scheduleStatus(branch, at('2026-11-16T18:30:00Z'))).toEqual({
      open: false,
      label: 'Cerrada · abre hoy a las 3:00 p. m.',
    })
    expect(scheduleStatus(branch, at('2026-11-17T02:00:00Z')).label).toBe(
      'Cerrada · abre mañana a las 8:00 a. m.',
    )
    expect(scheduleStatus(branch, at('2026-11-21T20:00:00Z')).label).toBe(
      'Cerrada · abre el lunes a las 8:00 a. m.',
    )
  })

  it('handles inactive branches and missing schedules', () => {
    expect(scheduleStatus({ ...branch, active: false }).label).toBe('Sede inactiva')
    expect(scheduleStatus({ active: true, schedule: [] }).label).toBe('Horario por confirmar')
  })

  it('groups consecutive days with the same hours', () => {
    expect(summarizeSchedule(schedule)).toEqual([
      { days: 'Lun a Vie', hours: '8:00 a. m. – 1:00 p. m. y 3:00 p. m. – 8:00 p. m.' },
      { days: 'Sáb', hours: '9:00 a. m. – 2:00 p. m.' },
      { days: 'Dom', hours: 'Cerrado' },
    ])
  })

  it('validates the intervals of a day', () => {
    expect(scheduleDayError(lunchBreak)).toBeNull()
    expect(scheduleDayError([{ opensAt: '13:00', closesAt: '08:00' }])).toMatch(/posterior/)
    expect(
      scheduleDayError([
        { opensAt: '08:00', closesAt: '14:00' },
        { opensAt: '13:00', closesAt: '18:00' },
      ]),
    ).toMatch(/se cruzan/)
    expect(scheduleDayError([{ opensAt: '', closesAt: '13:00' }])).toMatch(/Completa/)
  })
})

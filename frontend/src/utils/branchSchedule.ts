import type { BranchScheduleDay, BranchScheduleInterval } from '../types/branch'

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000

export const MAX_INTERVALS_PER_DAY = 4

export const WEEK_DAYS = [
  { dayOfWeek: 1, short: 'Lun', long: 'lunes' },
  { dayOfWeek: 2, short: 'Mar', long: 'martes' },
  { dayOfWeek: 3, short: 'Mié', long: 'miércoles' },
  { dayOfWeek: 4, short: 'Jue', long: 'jueves' },
  { dayOfWeek: 5, short: 'Vie', long: 'viernes' },
  { dayOfWeek: 6, short: 'Sáb', long: 'sábado' },
  { dayOfWeek: 7, short: 'Dom', long: 'domingo' },
] as const

export interface ScheduleStatus {
  open: boolean
  label: string
}

export interface ScheduleSummaryRow {
  days: string
  hours: string
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function bogotaWeekTime(now = new Date()): { dayOfWeek: number; minutes: number } {
  const local = new Date(now.getTime() - BOGOTA_OFFSET_MS)
  const day = local.getUTCDay()
  return {
    dayOfWeek: day === 0 ? 7 : day,
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  }
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours < 12 ? 'a. m.' : 'p. m.'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export function formatInterval(interval: BranchScheduleInterval): string {
  return `${formatTime(interval.opensAt)} – ${formatTime(interval.closesAt)}`
}

export function normalizeSchedule(schedule: BranchScheduleDay[] | undefined): BranchScheduleDay[] {
  return WEEK_DAYS.map(({ dayOfWeek }) => ({
    dayOfWeek,
    intervals: [...(schedule?.find((day) => day.dayOfWeek === dayOfWeek)?.intervals ?? [])].sort(
      (a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt),
    ),
  }))
}

export function hasSchedule(schedule: BranchScheduleDay[] | undefined): boolean {
  return (schedule ?? []).some((day) => day.intervals.length > 0)
}

function dayName(dayOfWeek: number): string {
  return WEEK_DAYS.find((day) => day.dayOfWeek === dayOfWeek)?.long ?? ''
}

export function scheduleStatus(
  branch: { active: boolean; schedule?: BranchScheduleDay[] },
  now = new Date(),
): ScheduleStatus {
  if (!branch.active) return { open: false, label: 'Sede inactiva' }
  if (!hasSchedule(branch.schedule)) return { open: false, label: 'Horario por confirmar' }

  const week = normalizeSchedule(branch.schedule)
  const { dayOfWeek, minutes } = bogotaWeekTime(now)
  const today = week[dayOfWeek - 1].intervals
  const current = today.find(
    (interval) => toMinutes(interval.opensAt) <= minutes && minutes < toMinutes(interval.closesAt),
  )
  if (current) {
    return { open: true, label: `Abierta · cierra a las ${formatTime(current.closesAt)}` }
  }

  const laterToday = today.find((interval) => toMinutes(interval.opensAt) > minutes)
  if (laterToday) {
    return { open: false, label: `Cerrada · abre hoy a las ${formatTime(laterToday.opensAt)}` }
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDay = ((dayOfWeek - 1 + offset) % 7) + 1
    const [first] = week[nextDay - 1].intervals
    if (first) {
      const when = offset === 1 ? 'mañana' : `el ${dayName(nextDay)}`
      return { open: false, label: `Cerrada · abre ${when} a las ${formatTime(first.opensAt)}` }
    }
  }
  return { open: false, label: 'Cerrada' }
}

function sameIntervals(a: BranchScheduleInterval[], b: BranchScheduleInterval[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (interval, index) =>
        interval.opensAt === b[index].opensAt && interval.closesAt === b[index].closesAt,
    )
  )
}

export function summarizeSchedule(schedule: BranchScheduleDay[] | undefined): ScheduleSummaryRow[] {
  const week = normalizeSchedule(schedule)
  const groups: { from: number; to: number; intervals: BranchScheduleInterval[] }[] = []
  for (const day of week) {
    const last = groups[groups.length - 1]
    if (last && sameIntervals(last.intervals, day.intervals)) last.to = day.dayOfWeek
    else groups.push({ from: day.dayOfWeek, to: day.dayOfWeek, intervals: day.intervals })
  }
  return groups.map(({ from, to, intervals }) => {
    const first = WEEK_DAYS[from - 1].short
    const last = WEEK_DAYS[to - 1].short
    const days = from === to ? first : to === from + 1 ? `${first} y ${last}` : `${first} a ${last}`
    return {
      days,
      hours: intervals.length === 0 ? 'Cerrado' : intervals.map(formatInterval).join(' y '),
    }
  })
}

export function scheduleDayError(intervals: BranchScheduleInterval[]): string | null {
  const sorted = [...intervals].sort((a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt))
  for (const [index, interval] of sorted.entries()) {
    if (!interval.opensAt || !interval.closesAt) return 'Completa la hora de apertura y de cierre.'
    if (toMinutes(interval.opensAt) >= toMinutes(interval.closesAt)) {
      return 'La hora de cierre debe ser posterior a la de apertura.'
    }
    const previous = sorted[index - 1]
    if (previous && toMinutes(interval.opensAt) < toMinutes(previous.closesAt)) {
      return 'Los tramos del día se cruzan entre sí.'
    }
  }
  return null
}

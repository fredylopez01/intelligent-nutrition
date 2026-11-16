import { useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../../hooks/useAuth'
import { branchesService } from '../../services/branches.service'
import { ApiError } from '../../services/http'
import type { Branch, BranchScheduleInterval } from '../../types/branch'
import {
  MAX_INTERVALS_PER_DAY,
  WEEK_DAYS,
  normalizeSchedule,
  scheduleDayError,
} from '../../utils/branchSchedule'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

import './BranchForm.css'
import './BranchScheduleForm.css'

interface DayState {
  dayOfWeek: number
  open: boolean
  intervals: BranchScheduleInterval[]
}

interface BranchScheduleFormProps {
  branch: Branch
  onUpdated: (branch: Branch) => void
  onCancel: () => void
}

const DEFAULT_INTERVAL: BranchScheduleInterval = { opensAt: '08:00', closesAt: '20:00' }

function initialDays(branch: Branch): DayState[] {
  return normalizeSchedule(branch.schedule).map((day) => ({
    dayOfWeek: day.dayOfWeek,
    open: day.intervals.length > 0,
    intervals: day.intervals.length > 0 ? day.intervals : [DEFAULT_INTERVAL],
  }))
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'No tienes permiso para cambiar el horario.'
    if (error.status === 404) return 'Esta sede ya no existe. Recarga el listado.'
    if (error.status === 400) return 'Revisa los tramos: hay horas inválidas o que se cruzan.'
    return error.message
  }
  return 'No fue posible guardar el horario. Intenta de nuevo.'
}

export function BranchScheduleForm({ branch, onUpdated, onCancel }: BranchScheduleFormProps) {
  const { token } = useAuth()
  const [days, setDays] = useState<DayState[]>(() => initialDays(branch))
  const [showErrors, setShowErrors] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const errors = days.map((day) => (day.open ? scheduleDayError(day.intervals) : null))

  const updateDay = (dayOfWeek: number, change: (day: DayState) => DayState) =>
    setDays((previous) => previous.map((day) => (day.dayOfWeek === dayOfWeek ? change(day) : day)))

  const updateInterval = (
    dayOfWeek: number,
    index: number,
    field: keyof BranchScheduleInterval,
    value: string,
  ) =>
    updateDay(dayOfWeek, (day) => ({
      ...day,
      intervals: day.intervals.map((interval, position) =>
        position === index ? { ...interval, [field]: value } : interval,
      ),
    }))

  const copyMondayToWeekdays = () => {
    const monday = days[0]
    setDays((previous) =>
      previous.map((day) =>
        day.dayOfWeek >= 2 && day.dayOfWeek <= 5
          ? { ...day, open: monday.open, intervals: monday.intervals.map((item) => ({ ...item })) }
          : day,
      ),
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    if (errors.some(Boolean)) {
      setShowErrors(true)
      setSubmitError('Corrige los días marcados antes de guardar.')
      return
    }
    setIsSubmitting(true)
    try {
      const updated = await branchesService.updateSchedule(
        branch.id,
        {
          days: days.map((day) => ({
            dayOfWeek: day.dayOfWeek,
            intervals: day.open ? day.intervals : [],
          })),
        },
        token,
      )
      onUpdated(updated)
    } catch (error) {
      setSubmitError(resolveErrorMessage(error))
      setIsSubmitting(false)
    }
  }

  return (
    <form className="branch-form" onSubmit={handleSubmit} noValidate>
      {submitError && <Alert tone="error">{submitError}</Alert>}
      <p className="branch-schedule__intro">
        Agrega varios tramos por día si la sede cierra al mediodía. Los días sin marcar quedan
        cerrados. La landing calcula con este horario si la sede está abierta.
      </p>
      <ul className="branch-schedule">
        {WEEK_DAYS.map((weekDay, dayIndex) => {
          const day = days[dayIndex]
          const error = showErrors ? errors[dayIndex] : null
          const errorId = `schedule-error-${weekDay.dayOfWeek}`
          return (
            <li key={weekDay.dayOfWeek} className="branch-schedule__day">
              <label className="branch-schedule__toggle">
                <input
                  type="checkbox"
                  checked={day.open}
                  onChange={(event) =>
                    updateDay(weekDay.dayOfWeek, (current) => ({
                      ...current,
                      open: event.target.checked,
                    }))
                  }
                />
                <span className="branch-schedule__name">{weekDay.long}</span>
              </label>
              {day.open ? (
                <div className="branch-schedule__intervals">
                  {day.intervals.map((interval, index) => (
                    <div key={index} className="branch-schedule__interval">
                      <input
                        type="time"
                        className="branch-schedule__time"
                        aria-label={`Apertura del ${weekDay.long}, tramo ${index + 1}`}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        value={interval.opensAt}
                        onChange={(event) =>
                          updateInterval(weekDay.dayOfWeek, index, 'opensAt', event.target.value)
                        }
                      />
                      <span className="branch-schedule__to" aria-hidden="true">
                        a
                      </span>
                      <input
                        type="time"
                        className="branch-schedule__time"
                        aria-label={`Cierre del ${weekDay.long}, tramo ${index + 1}`}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        value={interval.closesAt}
                        onChange={(event) =>
                          updateInterval(weekDay.dayOfWeek, index, 'closesAt', event.target.value)
                        }
                      />
                      {day.intervals.length > 1 && (
                        <button
                          type="button"
                          className="branch-schedule__remove"
                          aria-label={`Quitar el tramo ${index + 1} del ${weekDay.long}`}
                          onClick={() =>
                            updateDay(weekDay.dayOfWeek, (current) => ({
                              ...current,
                              intervals: current.intervals.filter(
                                (_, position) => position !== index,
                              ),
                            }))
                          }
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {day.intervals.length < MAX_INTERVALS_PER_DAY && (
                    <button
                      type="button"
                      className="branch-schedule__add"
                      onClick={() =>
                        updateDay(weekDay.dayOfWeek, (current) => ({
                          ...current,
                          intervals: [
                            ...current.intervals,
                            {
                              opensAt:
                                current.intervals[current.intervals.length - 1]?.closesAt ??
                                '08:00',
                              closesAt: '20:00',
                            },
                          ],
                        }))
                      }
                    >
                      Agregar tramo
                    </button>
                  )}
                  {error && (
                    <p id={errorId} className="branch-schedule__error">
                      {error}
                    </p>
                  )}
                </div>
              ) : (
                <span className="branch-schedule__closed">Cerrado</span>
              )}
              {weekDay.dayOfWeek === 1 && (
                <button
                  type="button"
                  className="branch-schedule__copy"
                  onClick={copyMondayToWeekdays}
                >
                  Copiar a martes–viernes
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="branch-form__actions">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar horario'}
        </Button>
      </div>
    </form>
  )
}

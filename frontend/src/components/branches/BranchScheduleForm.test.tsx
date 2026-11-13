import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { branchesService } from '../../services/branches.service'
import { ApiError } from '../../services/http'
import type { Branch } from '../../types/branch'

import { BranchScheduleForm } from './BranchScheduleForm'

vi.mock('../../services/branches.service', () => ({
  branchesService: { updateSchedule: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

const updateSchedule = vi.mocked(branchesService.updateSchedule)
const branch: Branch = {
  id: 'branch-1',
  name: 'Sede Makro',
  address: 'Calle 1',
  phone: '3001',
  active: true,
  schedule: [
    {
      dayOfWeek: 1,
      intervals: [
        { opensAt: '08:00', closesAt: '13:00' },
        { opensAt: '15:00', closesAt: '20:00' },
      ],
    },
  ],
}

function renderForm() {
  const onUpdated = vi.fn()
  const onCancel = vi.fn()
  const user = userEvent.setup()
  render(<BranchScheduleForm branch={branch} onUpdated={onUpdated} onCancel={onCancel} />)
  return { user, onUpdated, onCancel }
}

async function setTime(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  const input = screen.getByLabelText(label)
  await user.clear(input)
  await user.type(input, value)
}

beforeEach(() => {
  vi.resetAllMocks()
  updateSchedule.mockImplementation(async (_id, payload) => ({ ...branch, schedule: payload.days }))
})

describe('BranchScheduleForm', () => {
  it('loads the current week with the lunch break', () => {
    renderForm()

    expect(screen.getByRole('checkbox', { name: 'lunes' })).toBeChecked()
    expect(screen.getByLabelText('Cierre del lunes, tramo 1')).toHaveValue('13:00')
    expect(screen.getByLabelText('Apertura del lunes, tramo 2')).toHaveValue('15:00')
    expect(screen.getByRole('checkbox', { name: 'domingo' })).not.toBeChecked()
    expect(screen.getAllByText('Cerrado')).toHaveLength(6)
  })

  it('copies Monday to the weekdays, opens Saturday and saves the whole week', async () => {
    const { user, onUpdated } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Copiar a martes–viernes' }))
    await user.click(screen.getByRole('checkbox', { name: 'sábado' }))
    await setTime(user, 'Apertura del sábado, tramo 1', '09:00')
    await setTime(user, 'Cierre del sábado, tramo 1', '14:00')
    await user.click(screen.getByRole('button', { name: 'Guardar horario' }))

    const lunchBreak = branch.schedule?.[0].intervals
    expect(updateSchedule).toHaveBeenCalledWith(
      'branch-1',
      {
        days: [
          ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, intervals: lunchBreak })),
          { dayOfWeek: 6, intervals: [{ opensAt: '09:00', closesAt: '14:00' }] },
          { dayOfWeek: 7, intervals: [] },
        ],
      },
      'test-token',
    )
    expect(onUpdated).toHaveBeenCalled()
  })

  it('adds and removes intervals', async () => {
    const { user } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Quitar el tramo 2 del lunes' }))
    expect(screen.queryByLabelText('Apertura del lunes, tramo 2')).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Agregar tramo' })[0])
    expect(screen.getByLabelText('Apertura del lunes, tramo 2')).toHaveValue('13:00')
  })

  it('blocks overlapping intervals before calling the API', async () => {
    const { user } = renderForm()

    await setTime(user, 'Apertura del lunes, tramo 2', '12:00')
    await user.click(screen.getByRole('button', { name: 'Guardar horario' }))

    expect(screen.getByText('Corrige los días marcados antes de guardar.')).toBeInTheDocument()
    expect(screen.getByText('Los tramos del día se cruzan entre sí.')).toBeInTheDocument()
    expect(screen.getByLabelText('Apertura del lunes, tramo 2')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(updateSchedule).not.toHaveBeenCalled()
  })

  it('explains an API error', async () => {
    updateSchedule.mockRejectedValue(new ApiError('Forbidden', 403))
    const { user } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Guardar horario' }))

    expect(
      await screen.findByText('No tienes permiso para cambiar el horario.'),
    ).toBeInTheDocument()
  })
})

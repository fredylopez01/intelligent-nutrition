import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Branch } from '../../types/branch'

import { BranchesTable } from './BranchesTable'

const branches: Branch[] = [
  {
    id: 'branch-1',
    name: 'Sede Makro',
    address: 'Av. Universitaria 20-30, Tunja',
    phone: '3007000001',
    active: true,
  },
  {
    id: 'branch-2',
    name: 'Sede Sogamoso',
    address: 'Calle 11 # 14-20, Sogamoso',
    phone: '3007000002',
    active: false,
  },
]

function renderTable(rows: Branch[] = branches) {
  const onEdit = vi.fn()
  const onSchedule = vi.fn()
  const onToggleStatus = vi.fn()
  const user = userEvent.setup()
  render(
    <BranchesTable
      branches={rows}
      onEdit={onEdit}
      onSchedule={onSchedule}
      onToggleStatus={onToggleStatus}
    />,
  )
  return { user, onEdit, onSchedule, onToggleStatus }
}

function getRow(name: string) {
  const row = screen.getByRole('cell', { name }).closest('tr')
  if (!row) throw new Error(`No row found for ${name}`)
  return row
}

describe('BranchesTable', () => {
  it('shows the column headers', () => {
    renderTable()

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers).toEqual(['Nombre', 'Dirección', 'Teléfono', 'Horario', 'Estado', 'Acciones'])
  })

  it('renders one row per branch with its data and status', () => {
    renderTable()

    expect(screen.getAllByRole('row')).toHaveLength(branches.length + 1)

    const makro = within(getRow('Sede Makro'))
    expect(makro.getByText('Av. Universitaria 20-30, Tunja')).toBeInTheDocument()
    expect(makro.getByText('3007000001')).toBeInTheDocument()
    expect(makro.getByText('Activo')).toBeInTheDocument()

    const sogamoso = within(getRow('Sede Sogamoso'))
    expect(sogamoso.getByText('Calle 11 # 14-20, Sogamoso')).toBeInTheDocument()
    expect(sogamoso.getByText('Inactivo')).toBeInTheDocument()
    expect(sogamoso.getByText('Sede inactiva')).toBeInTheDocument()
    expect(makro.getByText('Horario por confirmar')).toBeInTheDocument()
  })

  it('shows whether an active branch is open by its schedule', () => {
    renderTable([
      {
        ...branches[0],
        schedule: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
          dayOfWeek,
          intervals: [{ opensAt: '00:00', closesAt: '23:59' }],
        })),
      },
    ])

    expect(
      within(getRow('Sede Makro')).getByText('Abierta · cierra a las 11:59 p. m.'),
    ).toBeInTheDocument()
  })

  it('opens the schedule of the selected branch', async () => {
    const { user, onSchedule } = renderTable()

    await user.click(screen.getByRole('button', { name: 'Acciones para Sede Makro' }))
    await user.click(screen.getByRole('menuitem', { name: 'Horario' }))

    expect(onSchedule).toHaveBeenCalledWith(branches[0])
  })

  it('renders only the header when there are no branches', () => {
    renderTable([])

    expect(screen.getAllByRole('row')).toHaveLength(1)
  })

  it('opens the edit action for the selected branch', async () => {
    const { user, onEdit, onToggleStatus } = renderTable()

    await user.click(screen.getByRole('button', { name: 'Acciones para Sede Makro' }))
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }))

    expect(onEdit).toHaveBeenCalledWith(branches[0])
    expect(onToggleStatus).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('offers to deactivate an active branch', async () => {
    const { user, onToggleStatus } = renderTable()

    await user.click(screen.getByRole('button', { name: 'Acciones para Sede Makro' }))
    await user.click(screen.getByRole('menuitem', { name: 'Desactivar' }))

    expect(onToggleStatus).toHaveBeenCalledWith(branches[0])
  })

  it('offers to activate an inactive branch', async () => {
    const { user, onToggleStatus } = renderTable()

    await user.click(screen.getByRole('button', { name: 'Acciones para Sede Sogamoso' }))

    expect(screen.queryByRole('menuitem', { name: 'Desactivar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Activar' }))

    expect(onToggleStatus).toHaveBeenCalledWith(branches[1])
  })
})

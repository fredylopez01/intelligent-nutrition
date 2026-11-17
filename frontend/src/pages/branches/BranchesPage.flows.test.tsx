import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { branchesService } from '../../services/branches.service'
import { ApiError } from '../../services/http'
import type { Branch, BranchesListResponse } from '../../types/branch'

import { BranchesPage } from './BranchesPage'

vi.mock('../../services/branches.service', () => ({
  branchesService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    updateSchedule: vi.fn(),
  },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

vi.mock('../../layouts/AppLayout', () => ({
  AppLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

const listBranches = vi.mocked(branchesService.list)
const createBranch = vi.mocked(branchesService.create)
const updateSchedule = vi.mocked(branchesService.updateSchedule)
const updateStatus = vi.mocked(branchesService.updateStatus)

const makro: Branch = {
  id: 'branch-1',
  name: 'Sede Makro',
  address: 'Av. Universitaria 20-30, Tunja',
  phone: '3007000001',
  active: true,
}

function pageOf(data: Branch[], extra: Partial<BranchesListResponse> = {}): BranchesListResponse {
  return {
    data,
    meta: { page: 1, limit: 10, total: data.length, totalPages: data.length ? 1 : 0 },
    ...extra,
  }
}

function renderPage(path = '/') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <BranchesPage />
    </MemoryRouter>,
  )
  return { user }
}

beforeEach(() => {
  vi.resetAllMocks()
  listBranches.mockResolvedValue(pageOf([makro]))
})

describe('BranchesPage create flow', () => {
  it('shows the success message and reloads after creating a branch', async () => {
    createBranch.mockResolvedValue({ ...makro, id: 'branch-2', name: 'Sede Norte' })

    const { user } = renderPage()
    await screen.findByRole('cell', { name: 'Sede Makro' })
    const requestsBeforeCreate = listBranches.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Registrar sede' }))
    const dialog = screen.getByRole('dialog', { name: 'Registrar sede' })
    const withinDialog = within(dialog)

    await user.type(withinDialog.getByLabelText('Nombre'), 'Sede Norte')
    await user.type(withinDialog.getByLabelText('Dirección'), 'Carrera 10 # 20-30')
    await user.type(withinDialog.getByLabelText('Teléfono'), '6017000000')
    await user.click(withinDialog.getByRole('button', { name: 'Registrar sede' }))

    expect(await screen.findByText('Sede creada exitosamente.')).toBeInTheDocument()
    expect(createBranch).toHaveBeenCalledWith(
      { name: 'Sede Norte', address: 'Carrera 10 # 20-30', phone: '6017000000' },
      'test-token',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(listBranches.mock.calls.length).toBeGreaterThan(requestsBeforeCreate),
    )
  })

  it('returns to page 1 when a branch is created from a later page', async () => {
    createBranch.mockResolvedValue({ ...makro, id: 'branch-2', name: 'Sede Norte' })
    listBranches.mockResolvedValue({
      data: [makro],
      meta: { page: 2, limit: 10, total: 30, totalPages: 3 },
    })

    const { user } = renderPage('/?pagina=2')
    await screen.findByRole('button', { name: 'Página 2 de 3', current: 'page' })

    await user.click(screen.getByRole('button', { name: 'Registrar sede' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Registrar sede' }))

    await user.type(dialog.getByLabelText('Nombre'), 'Sede Norte')
    await user.type(dialog.getByLabelText('Dirección'), 'Carrera 10 # 20-30')
    await user.type(dialog.getByLabelText('Teléfono'), '6017000000')
    await user.click(dialog.getByRole('button', { name: 'Registrar sede' }))

    await waitFor(() =>
      expect(listBranches).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
        'test-token',
      ),
    )
  })
})

describe('BranchesPage error state', () => {
  it('shows the error and retries when the list fails to load', async () => {
    listBranches.mockReset()
    listBranches
      .mockRejectedValueOnce(new ApiError('boom', 500))
      .mockResolvedValue(pageOf([makro]))

    const { user } = renderPage()

    expect(await screen.findByText('boom')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('cell', { name: 'Sede Makro' })).toBeInTheDocument()
  })
})

describe('BranchesPage schedule flow', () => {
  it('shows the success message and reloads after the schedule is saved', async () => {
    updateSchedule.mockResolvedValue({ ...makro, id: 'branch-1', name: 'Sede Makro' })

    const { user } = renderPage()
    await screen.findByRole('cell', { name: 'Sede Makro' })
    const requestsBeforeSave = listBranches.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Acciones para Sede Makro' }))
    await user.click(screen.getByRole('menuitem', { name: 'Horario' }))

    expect(screen.getByRole('dialog', { name: 'Horario de Sede Makro' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar horario' }))

    expect(
      await screen.findByText('El horario de Sede Makro se guardó correctamente.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(listBranches.mock.calls.length).toBeGreaterThan(requestsBeforeSave),
    )
  })
})

describe('BranchesPage status flow', () => {
  it('announces that the branch was deactivated and reloads', async () => {
    updateStatus.mockResolvedValue({ ...makro, active: false })

    const { user } = renderPage()
    await screen.findByRole('cell', { name: 'Sede Makro' })
    const requestsBeforeChange = listBranches.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Acciones para Sede Makro' }))
    await user.click(screen.getByRole('menuitem', { name: 'Desactivar' }))

    expect(
      screen.getByRole('dialog', { name: '¿Desactivar esta sede?' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sí, desactivar' }))

    expect(await screen.findByText('La sede Sede Makro ahora está inactiva.')).toBeInTheDocument()
    expect(updateStatus).toHaveBeenCalledWith('branch-1', { active: false }, 'test-token')
    await waitFor(() =>
      expect(listBranches.mock.calls.length).toBeGreaterThan(requestsBeforeChange),
    )
  })
})

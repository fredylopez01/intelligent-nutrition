import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { branchesService } from '../../services/branches.service'
import { ApiError } from '../../services/http'
import { suppliesService } from '../../services/supplies.service'
import { unitsService } from '../../services/units.service'
import type { SupplyStockRow } from '../../types/supply'

import { SuppliesPage } from './SuppliesPage'

const auth = vi.hoisted(() => ({
  role: 'BRANCH_LEADER',
  branches: [] as { id: string; name: string }[],
}))

vi.mock('../../services/supplies.service', () => ({
  suppliesService: { stock: vi.fn(), create: vi.fn(), move: vi.fn(), setMinimum: vi.fn() },
}))

vi.mock('../../services/units.service', () => ({
  unitsService: { list: vi.fn() },
}))

vi.mock('../../services/branches.service', () => ({
  branchesService: { list: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'me', role: { name: auth.role }, branches: auth.branches },
  }),
}))

vi.mock('../../layouts/AppLayout', () => ({
  AppLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

const stock = vi.mocked(suppliesService.stock)
const move = vi.mocked(suppliesService.move)
const setMinimum = vi.mocked(suppliesService.setMinimum)
const createSupply = vi.mocked(suppliesService.create)
const centro = { id: 'branch-centro', name: 'Centro' }
const norte = { id: 'branch-norte', name: 'Norte' }

function row(overrides: Partial<SupplyStockRow> = {}): SupplyStockRow {
  return {
    supplyId: 'supply-milk',
    supply: { name: 'Leche entera', unitOfMeasure: { id: 'unit-ml', abbreviation: 'ml' } },
    branchId: centro.id,
    branchName: centro.name,
    quantity: '500.000',
    minimumQuantity: '1000.000',
    lowStock: true,
    updatedAt: '2026-11-12T10:00:00.000Z',
    ...overrides,
  }
}

const MILK = row()
const OATS = row({
  supplyId: 'supply-oats',
  supply: { name: 'Avena en hojuelas', unitOfMeasure: { id: 'unit-g', abbreviation: 'g' } },
  quantity: '2500.000',
  minimumQuantity: '1000.000',
  lowStock: false,
})

function stockPage(rows: SupplyStockRow[]) {
  return {
    data: rows,
    meta: { page: 1, limit: 20, total: rows.length, totalPages: rows.length ? 1 : 0 },
  }
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

function renderPage(path = '/inventario/insumos') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <SuppliesPage />
      <LocationProbe />
    </MemoryRouter>,
  )
  return { user, url: () => screen.getByTestId('location').textContent }
}

function rowOf(name: string) {
  return within(screen.getByText(name).closest('tr') as HTMLElement)
}

async function openAction(user: ReturnType<typeof userEvent.setup>, label: string, action: string) {
  await user.click(screen.getByRole('button', { name: label }))
  await user.click(screen.getByRole('menuitem', { name: action }))
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.role = 'BRANCH_LEADER'
  auth.branches = [centro]
  stock.mockResolvedValue(stockPage([MILK, OATS]))
})

describe('SuppliesPage list', () => {
  it('shows the stock of the branch and marks the low stock', async () => {
    renderPage()

    expect(await screen.findByText('Leche entera')).toBeInTheDocument()
    expect(stock).toHaveBeenCalledWith(
      { page: 1, limit: 20, search: undefined, branchId: centro.id, lowStock: undefined },
      'test-token',
    )
    expect(rowOf('Leche entera').getByText('500')).toBeInTheDocument()
    expect(rowOf('Leche entera').getByText('Bajo mínimo')).toBeInTheDocument()
    expect(screen.getByText('Leche entera').closest('tr')).toHaveClass('inventory-table__row--low')
    expect(rowOf('Avena en hojuelas').getByText('En nivel')).toBeInTheDocument()
    expect(screen.getByText('Avena en hojuelas').closest('tr')).not.toHaveClass(
      'inventory-table__row--low',
    )
  })

  it('filters the low stock and keeps it in the URL', async () => {
    const { user, url } = renderPage()
    await screen.findByText('Leche entera')

    await user.selectOptions(screen.getByLabelText('Filtrar por stock'), 'bajo')

    await waitFor(() =>
      expect(stock).toHaveBeenLastCalledWith(
        expect.objectContaining({ lowStock: true }),
        'test-token',
      ),
    )
    expect(url()).toContain('stock=bajo')
  })

  it('shows a loading state and then the error with a retry', async () => {
    stock.mockReset()
    stock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(stockPage([MILK]))
    const { user } = renderPage()

    expect(screen.getByText('Cargando insumos...')).toBeInTheDocument()
    expect(
      await screen.findByText('No fue posible cargar los insumos. Intenta de nuevo.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Leche entera')).toBeInTheDocument()
  })

  it('invites to register the first supply', async () => {
    stock.mockResolvedValue(stockPage([]))
    renderPage()

    expect(await screen.findByText('Todavía no hay insumos')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Registrar insumo' })).toHaveLength(2)
  })

  it('lets the superadmin see every branch and register movements', async () => {
    auth.role = 'SUPERADMIN'
    vi.mocked(branchesService.list).mockResolvedValue({
      data: [
        { ...centro, active: true },
        { ...norte, active: true },
      ],
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    } as never)
    stock.mockResolvedValue(stockPage([MILK, row({ branchId: norte.id, branchName: norte.name })]))
    const { user } = renderPage()

    await waitFor(() =>
      expect(stock).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: undefined }),
        'test-token',
      ),
    )
    expect(await screen.findByRole('columnheader', { name: 'Sede' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Acciones para Leche entera en Norte' }))
    expect(screen.getByRole('menuitem', { name: 'Registrar entrada o salida' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Cambiar stock mínimo' })).toBeInTheDocument()
    expect(
      screen.queryByText(
        'Las entradas y salidas de insumos las registra el personal de cada sede.',
      ),
    ).not.toBeInTheDocument()
  })

  it('lets the assistant register movements but not change the minimum nor create supplies', async () => {
    auth.role = 'BRANCH_ASSISTANT'
    const { user } = renderPage()
    await screen.findByText('Leche entera')

    expect(screen.queryByRole('button', { name: 'Registrar insumo' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Acciones para Leche entera' }))
    expect(screen.getByRole('menuitem', { name: 'Registrar entrada o salida' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Cambiar stock mínimo' })).not.toBeInTheDocument()
  })
})

describe('SuppliesPage movements', () => {
  it('registers an entry and shows the resulting stock', async () => {
    move.mockResolvedValue({
      id: 'mv-1',
      movementType: 'ENTRY',
      quantity: '700',
      supply: { id: MILK.supplyId, name: 'Leche entera' },
      branch: centro,
      user: { id: 'me', fullName: 'Laura' },
      observation: null,
      resultingQuantity: '1200',
      movementAt: '2026-11-12T10:00:00.000Z',
    })
    const { user } = renderPage()
    await screen.findByText('Leche entera')

    await openAction(user, 'Acciones para Leche entera', 'Registrar entrada o salida')
    const dialog = within(screen.getByRole('dialog', { name: 'Entrada o salida de Leche entera' }))
    expect(dialog.getByText('500 ml')).toBeInTheDocument()
    await user.type(dialog.getByLabelText('Cantidad (ml)'), '700')
    expect(dialog.getByRole('status')).toHaveTextContent(
      'Después del movimiento quedarán 1.200 ml.',
    )
    await user.click(dialog.getByRole('button', { name: 'Registrar entrada' }))

    await waitFor(() =>
      expect(move).toHaveBeenCalledWith(
        { branchId: centro.id, supplyId: MILK.supplyId, movementType: 'ENTRY', quantity: 700 },
        'test-token',
      ),
    )
    expect(
      await screen.findByText('Entrada de 700 ml de Leche entera registrada. Quedan 1.200 ml.'),
    ).toBeInTheDocument()
  })

  it('does not let an exit take more than the available stock and asks for the reason', async () => {
    const { user } = renderPage()
    await screen.findByText('Leche entera')

    await openAction(user, 'Acciones para Leche entera', 'Registrar entrada o salida')
    const dialog = within(screen.getByRole('dialog'))
    await user.click(dialog.getByText('Salida'))
    await user.type(dialog.getByLabelText('Cantidad (ml)'), '600')
    await user.click(dialog.getByRole('button', { name: 'Registrar salida' }))

    expect(
      await dialog.findByText('Solo hay 500 ml disponibles. No puedes sacar más.'),
    ).toBeInTheDocument()
    expect(dialog.getByText('Escribe el motivo de la salida.')).toBeInTheDocument()
    expect(move).not.toHaveBeenCalled()
  })

  it('sends a valid exit with its reason', async () => {
    move.mockResolvedValue({
      id: 'mv-2',
      movementType: 'EXIT',
      quantity: '200',
      supply: { id: MILK.supplyId, name: 'Leche entera' },
      branch: centro,
      user: { id: 'me', fullName: 'Laura' },
      observation: 'Batidos',
      resultingQuantity: '300',
      movementAt: '2026-11-12T10:00:00.000Z',
    })
    const { user } = renderPage()
    await screen.findByText('Leche entera')

    await openAction(user, 'Acciones para Leche entera', 'Registrar entrada o salida')
    const dialog = within(screen.getByRole('dialog'))
    await user.click(dialog.getByText('Salida'))
    await user.type(dialog.getByLabelText('Cantidad (ml)'), '200')
    await user.type(dialog.getByLabelText('Motivo'), 'Batidos')
    await user.click(dialog.getByRole('button', { name: 'Registrar salida' }))

    await waitFor(() =>
      expect(move).toHaveBeenCalledWith(
        {
          branchId: centro.id,
          supplyId: MILK.supplyId,
          movementType: 'EXIT',
          quantity: 200,
          observation: 'Batidos',
        },
        'test-token',
      ),
    )
  })

  it('explains the stock error of the server', async () => {
    move.mockRejectedValue(new ApiError('x', 422, undefined, 'INSUFFICIENT_SUPPLY_STOCK'))
    const { user } = renderPage()
    await screen.findByText('Leche entera')

    await openAction(user, 'Acciones para Leche entera', 'Registrar entrada o salida')
    const dialog = within(screen.getByRole('dialog'))
    await user.click(dialog.getByText('Salida'))
    await user.type(dialog.getByLabelText('Cantidad (ml)'), '100')
    await user.type(dialog.getByLabelText('Motivo'), 'Merma')
    await user.click(dialog.getByRole('button', { name: 'Registrar salida' }))

    expect(await dialog.findByText(/No hay stock suficiente para esa salida/)).toBeInTheDocument()
  })
})

describe('SuppliesPage minimum and creation', () => {
  it('saves a new minimum and warns when the supply will be low', async () => {
    setMinimum.mockResolvedValue({ ...OATS, minimumQuantity: '3000.000', lowStock: true })
    const { user } = renderPage()
    await screen.findByText('Avena en hojuelas')

    await openAction(user, 'Acciones para Avena en hojuelas', 'Cambiar stock mínimo')
    const dialog = within(screen.getByRole('dialog', { name: 'Stock mínimo de Avena en hojuelas' }))
    const input = dialog.getByLabelText('Stock mínimo (g)')
    await user.clear(input)
    await user.type(input, '3000')
    expect(
      dialog.getByText('Con este mínimo el insumo quedará marcado con stock bajo.'),
    ).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Guardar mínimo' }))

    await waitFor(() =>
      expect(setMinimum).toHaveBeenCalledWith(
        { branchId: centro.id, supplyId: OATS.supplyId, minimumQuantity: 3000 },
        'test-token',
      ),
    )
    expect(
      await screen.findByText('El stock mínimo de Avena en hojuelas en Centro quedó en 3.000 g.'),
    ).toBeInTheDocument()
  })

  it('registers a new supply with its unit', async () => {
    vi.mocked(unitsService.list).mockResolvedValue({
      data: [{ id: 'unit-ml', name: 'Mililitro', abbreviation: 'ml', active: true }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    })
    createSupply.mockResolvedValue({
      id: 'supply-new',
      name: 'Leche deslactosada',
      unitOfMeasure: { id: 'unit-ml', abbreviation: 'ml' },
      active: true,
      createdAt: '2026-11-12T10:00:00.000Z',
    })
    const { user } = renderPage()
    await screen.findByText('Leche entera')

    await user.click(screen.getByRole('button', { name: 'Registrar insumo' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Registrar insumo' }))
    await user.type(dialog.getByLabelText('Nombre'), 'Leche deslactosada')
    await waitFor(() => expect(dialog.getByLabelText('Unidad de medida')).toBeEnabled())
    await user.selectOptions(dialog.getByLabelText('Unidad de medida'), 'unit-ml')
    await user.click(dialog.getByRole('button', { name: 'Registrar insumo' }))

    await waitFor(() =>
      expect(createSupply).toHaveBeenCalledWith(
        { name: 'Leche deslactosada', unitOfMeasureId: 'unit-ml' },
        'test-token',
      ),
    )
    expect(
      await screen.findByText(
        'Leche deslactosada quedó registrado en todas las sedes con stock 0 ml.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the duplicated name next to the field', async () => {
    vi.mocked(unitsService.list).mockResolvedValue({
      data: [{ id: 'unit-ml', name: 'Mililitro', abbreviation: 'ml', active: true }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    })
    createSupply.mockRejectedValue(
      new ApiError('Conflict', 409, undefined, 'SUPPLY_NAME_ALREADY_EXISTS'),
    )
    const { user } = renderPage()
    await screen.findByText('Leche entera')

    await user.click(screen.getByRole('button', { name: 'Registrar insumo' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Registrar insumo' }))
    await user.type(dialog.getByLabelText('Nombre'), 'Leche entera')
    await waitFor(() => expect(dialog.getByLabelText('Unidad de medida')).toBeEnabled())
    await user.selectOptions(dialog.getByLabelText('Unidad de medida'), 'unit-ml')
    await user.click(dialog.getByRole('button', { name: 'Registrar insumo' }))

    expect(await dialog.findByText('Ya existe un insumo con ese nombre.')).toBeInTheDocument()
  })
})

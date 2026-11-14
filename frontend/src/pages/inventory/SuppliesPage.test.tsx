import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { branchesService } from '../../services/branches.service'
import { ApiError } from '../../services/http'
import { inventoryService } from '../../services/inventory.service'
import { productsService } from '../../services/products.service'
import { suppliesService } from '../../services/supplies.service'
import { unitsService } from '../../services/units.service'
import type { BranchInventoryDetail } from '../../types/inventory'
import type { ProductsListResponse } from '../../types/product'
import type { SupplyStockRow } from '../../types/supply'

import { SuppliesPage } from './SuppliesPage'

const auth = vi.hoisted(() => ({
  role: 'BRANCH_LEADER',
  branches: [] as { id: string; name: string }[],
}))

vi.mock('../../services/supplies.service', () => ({
  suppliesService: {
    stock: vi.fn(),
    create: vi.fn(),
    move: vi.fn(),
    setMinimum: vi.fn(),
    updateLink: vi.fn(),
    convert: vi.fn(),
  },
}))

vi.mock('../../services/products.service', () => ({
  productsService: { list: vi.fn() },
}))

vi.mock('../../services/inventory.service', () => ({
  inventoryService: { getProductInBranch: vi.fn() },
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
const updateLink = vi.mocked(suppliesService.updateLink)
const convert = vi.mocked(suppliesService.convert)
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

const WHEY = {
  id: 'product-whey',
  name: 'Proteína Whey 2 lb',
  referenceCode: 'PRO-001',
  category: { id: 'cat-1', name: 'Proteínas' },
}

const WHEY_POWDER = row({
  supplyId: 'supply-whey',
  supply: { name: 'Proteína en polvo', unitOfMeasure: { id: 'unit-g', abbreviation: 'g' } },
  quantity: '100.000',
  minimumQuantity: '0.000',
  lowStock: false,
  sourceProduct: { id: WHEY.id, name: WHEY.name, unitQuantity: 900 },
})

function productsPage() {
  return {
    data: [WHEY],
    meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
  } as unknown as ProductsListResponse
}

function wheyInBranch(lots: { quantity: number; expirationDate: string }[]) {
  return {
    product: WHEY,
    branchId: centro.id,
    totalQuantity: lots.reduce((total, lot) => total + lot.quantity, 0),
    lots: lots.map((lot, index) => ({ id: `lot-${index}`, ...lot })),
  } as unknown as BranchInventoryDetail
}

describe('SuppliesPage product to supply', () => {
  it('links an existing supply to a catalog product', async () => {
    vi.mocked(productsService.list).mockResolvedValue(productsPage())
    updateLink.mockResolvedValue({
      id: OATS.supplyId,
      name: 'Avena en hojuelas',
      unitOfMeasure: { id: 'unit-g', abbreviation: 'g' },
      active: true,
      sourceProduct: { id: WHEY.id, name: WHEY.name },
      productUnitQuantity: 900,
      createdAt: '2026-11-12T10:00:00.000Z',
    })
    const { user } = renderPage()
    await screen.findByText('Avena en hojuelas')

    await openAction(user, 'Acciones para Avena en hojuelas', 'Ligar a un producto')
    const dialog = within(
      screen.getByRole('dialog', { name: 'Producto de origen de Avena en hojuelas' }),
    )
    await user.click(dialog.getByRole('button', { name: 'Guardar vínculo' }))
    expect(await dialog.findByText('Elige el producto del catálogo.')).toBeInTheDocument()

    await user.click(await dialog.findByRole('button', { name: /Proteína Whey 2 lb/ }))
    await user.type(dialog.getByLabelText('Cuánto rinde una unidad del producto (g)'), '900')
    await user.click(dialog.getByRole('button', { name: 'Guardar vínculo' }))

    await waitFor(() =>
      expect(updateLink).toHaveBeenCalledWith(
        OATS.supplyId,
        { sourceProductId: WHEY.id, productUnitQuantity: 900 },
        'test-token',
      ),
    )
    expect(
      await screen.findByText(
        'Avena en hojuelas quedó ligado a Proteína Whey 2 lb. Ya puedes convertir unidades en cualquier sede.',
      ),
    ).toBeInTheDocument()
  })

  it('converts product units into the supply with a preview', async () => {
    stock.mockResolvedValue(stockPage([MILK, WHEY_POWDER]))
    vi.mocked(inventoryService.getProductInBranch).mockResolvedValue(
      wheyInBranch([
        { quantity: 3, expirationDate: '2099-01-31' },
        { quantity: 5, expirationDate: '2020-01-31' },
      ]),
    )
    convert.mockResolvedValue({
      supply: { id: WHEY_POWDER.supplyId, name: 'Proteína en polvo' },
      product: { id: WHEY.id, name: WHEY.name },
      productUnits: 2,
      supplyQuantity: 1800,
      resultingSupplyQuantity: 1900,
      remainingProductUnits: 1,
    })
    const { user } = renderPage()
    await screen.findByText('Proteína en polvo')
    expect(
      rowOf('Proteína en polvo').getByText(/De Proteína Whey 2 lb · 1 und = 900 g/),
    ).toBeInTheDocument()

    await openAction(user, 'Acciones para Proteína en polvo', 'Convertir producto a insumo')
    const dialog = within(
      screen.getByRole('dialog', { name: 'Convertir producto a Proteína en polvo' }),
    )
    expect(await dialog.findByText('3')).toBeInTheDocument()
    const units = dialog.getByLabelText('Unidades del producto que vas a abrir')
    await user.clear(units)
    await user.type(units, '2')
    expect(dialog.getByRole('status')).toHaveTextContent(
      'Se descuentan 2 unidades de Proteína Whey 2 lb del inventario y se suman 1.800 g de Proteína en polvo. Quedarán 1.900 g.',
    )
    await user.click(dialog.getByRole('button', { name: 'Convertir a insumo' }))

    await waitFor(() =>
      expect(convert).toHaveBeenCalledWith(
        { branchId: centro.id, supplyId: WHEY_POWDER.supplyId, productUnits: 2 },
        'test-token',
      ),
    )
    expect(
      await screen.findByText(
        'Se abrieron 2 unidades de Proteína Whey 2 lb y se sumaron 1.800 g de Proteína en polvo. Quedan 1.900 g del insumo y 1 unidad del producto.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the units the branch really has when the server rejects the conversion', async () => {
    stock.mockResolvedValue(stockPage([WHEY_POWDER]))
    vi.mocked(inventoryService.getProductInBranch).mockResolvedValue(
      wheyInBranch([{ quantity: 4, expirationDate: '2099-01-31' }]),
    )
    convert.mockRejectedValue(
      new ApiError('Unprocessable', 422, { available: 1, requested: 3 }, 'INSUFFICIENT_STOCK'),
    )
    const { user } = renderPage()
    await screen.findByText('Proteína en polvo')

    await openAction(user, 'Acciones para Proteína en polvo', 'Convertir producto a insumo')
    const dialog = within(
      screen.getByRole('dialog', { name: 'Convertir producto a Proteína en polvo' }),
    )
    await dialog.findByText('4')
    const units = dialog.getByLabelText('Unidades del producto que vas a abrir')
    await user.clear(units)
    await user.type(units, '3')
    await user.click(dialog.getByRole('button', { name: 'Convertir a insumo' }))

    expect(
      await dialog.findByText('La sede solo tiene 1 unidad de Proteína Whey 2 lb sin vencer.'),
    ).toBeInTheDocument()
  })

  it('lets the assistant convert but not change the product of origin', async () => {
    auth.role = 'BRANCH_ASSISTANT'
    stock.mockResolvedValue(stockPage([MILK, WHEY_POWDER]))
    const { user } = renderPage()
    await screen.findByText('Proteína en polvo')

    await user.click(screen.getByRole('button', { name: 'Acciones para Proteína en polvo' }))
    expect(
      screen.getByRole('menuitem', { name: 'Convertir producto a insumo' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'Cambiar producto de origen' }),
    ).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Acciones para Leche entera' }))
    expect(
      screen.queryByRole('menuitem', { name: 'Convertir producto a insumo' }),
    ).not.toBeInTheDocument()
  })

  it('registers a supply that comes from a catalog product', async () => {
    vi.mocked(unitsService.list).mockResolvedValue({
      data: [{ id: 'unit-g', name: 'Gramo', abbreviation: 'g', active: true }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    })
    vi.mocked(productsService.list).mockResolvedValue(productsPage())
    createSupply.mockResolvedValue({
      id: 'supply-new',
      name: 'Proteína en polvo',
      unitOfMeasure: { id: 'unit-g', abbreviation: 'g' },
      active: true,
      createdAt: '2026-11-12T10:00:00.000Z',
    })
    const { user } = renderPage()
    await screen.findByText('Leche entera')

    await user.click(screen.getByRole('button', { name: 'Registrar insumo' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Registrar insumo' }))
    await user.type(dialog.getByLabelText('Nombre'), 'Proteína en polvo')
    await waitFor(() => expect(dialog.getByLabelText('Unidad de medida')).toBeEnabled())
    await user.selectOptions(dialog.getByLabelText('Unidad de medida'), 'unit-g')
    await user.click(dialog.getByLabelText(/Viene de un producto del catálogo/))
    await user.click(dialog.getByRole('button', { name: 'Registrar insumo' }))
    expect(
      await dialog.findByText('Escribe cuánto rinde una unidad del producto.'),
    ).toBeInTheDocument()
    expect(dialog.getByText('Elige el producto del catálogo.')).toBeInTheDocument()

    await user.click(await dialog.findByRole('button', { name: /Proteína Whey 2 lb/ }))
    await user.type(dialog.getByLabelText('Cuánto rinde una unidad del producto (g)'), '907,2')
    await user.click(dialog.getByRole('button', { name: 'Registrar insumo' }))

    await waitFor(() =>
      expect(createSupply).toHaveBeenCalledWith(
        {
          name: 'Proteína en polvo',
          unitOfMeasureId: 'unit-g',
          sourceProductId: WHEY.id,
          productUnitQuantity: 907.2,
        },
        'test-token',
      ),
    )
  })
})

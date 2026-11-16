import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { suppliersService } from '../../services/suppliers.service'
import { suppliesService } from '../../services/supplies.service'
import { supplyPurchasesService } from '../../services/supplyPurchases.service'
import type { SupplyPurchase } from '../../types/supplyPurchase'

import { SupplyPurchasesPage } from './SupplyPurchasesPage'

vi.mock('../../services/supplyPurchases.service', () => ({
  supplyPurchasesService: { list: vi.fn(), create: vi.fn(), receive: vi.fn(), get: vi.fn() },
}))

vi.mock('../../services/suppliers.service', () => ({
  suppliersService: { list: vi.fn() },
}))

vi.mock('../../services/supplies.service', () => ({
  suppliesService: { list: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: {
      id: 'me',
      role: { name: 'BRANCH_LEADER' },
      branches: [{ id: 'centro', name: 'Centro' }],
    },
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

const list = vi.mocked(supplyPurchasesService.list)
const create = vi.mocked(supplyPurchasesService.create)
const receive = vi.mocked(supplyPurchasesService.receive)

function purchase(overrides: Partial<SupplyPurchase> = {}): SupplyPurchase {
  return {
    id: 'purchase-1',
    purchaseNumber: 'CI-20261116-0001',
    status: 'PENDING_RECEIPT',
    purchaseAt: '2026-11-16T15:00:00.000Z',
    total: '21002.10',
    observation: null,
    supplier: { id: 'supplier-1', name: 'Lácteos Boyacá' },
    user: { id: 'me', fullName: 'Laura Restrepo' },
    items: [
      {
        id: 'line-milk',
        supply: { id: 'milk', name: 'Leche entera', unit: 'ml', unitName: 'Mililitro' },
        requestedQuantity: 5000.5,
        receivedQuantity: 0,
        pendingQuantity: 5000.5,
        unitCost: '4.20',
        subtotal: '21002.10',
      },
    ],
    ...overrides,
  }
}

function renderPage() {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <SupplyPurchasesPage />
    </MemoryRouter>,
  )
  return { user }
}

beforeEach(() => {
  vi.resetAllMocks()
  list.mockResolvedValue({
    data: [purchase()],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  vi.mocked(suppliersService.list).mockResolvedValue({
    data: [
      {
        id: 'supplier-1',
        commercialName: 'Lácteos Boyacá',
        person: { firstName: null, lastName: null, businessName: null, active: true },
      },
    ],
    meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
  } as never)
  vi.mocked(suppliesService.list).mockResolvedValue({
    data: [
      {
        id: 'milk',
        name: 'Leche entera',
        unitOfMeasure: { id: 'ml', abbreviation: 'ml' },
        active: true,
        createdAt: '',
      },
      {
        id: 'protein',
        name: 'Proteína a granel',
        unitOfMeasure: { id: 'g', abbreviation: 'g' },
        active: true,
        createdAt: '',
      },
    ],
    meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
  } as never)
})

describe('SupplyPurchasesPage', () => {
  it('lists the purchases of supplies', async () => {
    renderPage()

    const table = await screen.findByRole('table', { name: 'Compras de insumos' })
    const [row] = within(table).getAllByRole('row').slice(1)
    expect(within(row).getByText('CI-20261116-0001')).toBeInTheDocument()
    expect(within(row).getByText('Lácteos Boyacá')).toBeInTheDocument()
    expect(within(row).getByText('Pendiente de recibir')).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 20 }, 'test-token')
  })

  it('registers a purchase with several supplies and its total', async () => {
    create.mockResolvedValue(purchase())
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Nueva compra de insumos' }))
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))
    expect(await screen.findByText('Elige el proveedor.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Proveedor'), 'supplier-1')
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Leche entera (ml)' })).toBeInTheDocument(),
    )
    await user.selectOptions(screen.getByLabelText('Insumo de la línea 1'), 'milk')
    await user.type(screen.getByLabelText('Cantidad de la línea 1'), '5000,5')
    await user.type(screen.getByLabelText('Costo unitario de la línea 1'), '4.20')
    await user.click(screen.getByRole('button', { name: 'Agregar insumo' }))
    await user.selectOptions(screen.getByLabelText('Insumo de la línea 2'), 'milk')
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))
    expect(screen.getByText('Este insumo ya está en la compra.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Insumo de la línea 2'), 'protein')
    await user.type(screen.getByLabelText('Cantidad de la línea 2'), '2000')
    await user.type(screen.getByLabelText('Costo unitario de la línea 2'), '95')
    expect(screen.getByText(/211\.002,1/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(create).toHaveBeenCalledWith(
      {
        supplierId: 'supplier-1',
        items: [
          { supplyId: 'milk', quantity: 5000.5, unitCost: '4.20' },
          { supplyId: 'protein', quantity: 2000, unitCost: '95.00' },
        ],
      },
      'test-token',
    )
    expect(
      await screen.findByText(/La compra CI-20261116-0001 quedó registrada/),
    ).toBeInTheDocument()
  })

  it('receives part of a purchase in the branch of the leader', async () => {
    receive.mockResolvedValue(purchase({ status: 'PARTIALLY_RECEIVED' }))
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Ver la compra CI-20261116-0001' }))
    await user.click(screen.getByRole('button', { name: 'Recibir insumos' }))
    expect(screen.getByLabelText('Sede que recibe')).toHaveValue('centro')
    const quantity = screen.getByLabelText('Cantidad recibida de Leche entera')
    expect(quantity).toHaveValue('5000.5')
    await user.clear(quantity)
    await user.type(quantity, '6000')
    await user.click(screen.getByRole('button', { name: 'Registrar recepción' }))
    expect(screen.getByText(/no superar 5\.000,5 ml/)).toBeInTheDocument()

    await user.clear(quantity)
    await user.type(quantity, '3000')
    await user.click(screen.getByRole('button', { name: 'Registrar recepción' }))

    expect(receive).toHaveBeenCalledWith(
      'purchase-1',
      { branchId: 'centro', items: [{ detailId: 'line-milk', quantity: 3000 }] },
      'test-token',
    )
    expect(await screen.findByText(/Se registró la recepción de la compra/)).toBeInTheDocument()
  })

  it('explains an API error when receiving', async () => {
    receive.mockRejectedValue(new ApiError('x', 422, undefined, 'QUANTITY_EXCEEDS_PENDING'))
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Ver la compra CI-20261116-0001' }))
    await user.click(screen.getByRole('button', { name: 'Recibir insumos' }))
    await user.click(screen.getByRole('button', { name: 'Registrar recepción' }))

    expect(
      await screen.findByText('Una de las cantidades supera lo que falta por recibir.'),
    ).toBeInTheDocument()
  })
})

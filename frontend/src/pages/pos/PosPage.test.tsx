import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { categoriesService } from '../../services/categories.service'
import { ApiError } from '../../services/http'
import { paymentMethodsService } from '../../services/paymentMethods.service'
import { promotionsService } from '../../services/promotions.service'
import { salesService } from '../../services/sales.service'
import { unitsService } from '../../services/units.service'
import { CASH, NEQUI, paymentMethodsPage } from '../../test-utils/paymentMethods'
import { buildPromotion } from '../../test-utils/promotions'
import { buildSale, buildSellable } from '../../test-utils/sales'
import type { SellableProduct } from '../../types/sale'

import { PosPage } from './PosPage'

const auth = vi.hoisted(() => ({
  role: 'BRANCH_ASSISTANT',
  branches: [] as { id: string; name: string }[],
}))

vi.mock('../../services/sales.service', () => ({
  salesService: { sellableProducts: vi.fn(), create: vi.fn() },
}))

vi.mock('../../services/paymentMethods.service', () => ({
  paymentMethodsService: { list: vi.fn() },
}))

vi.mock('../../services/promotions.service', () => ({
  promotionsService: { listApplicable: vi.fn() },
}))

vi.mock('../../services/categories.service', () => ({
  categoriesService: { list: vi.fn() },
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

const sellable = vi.mocked(salesService.sellableProducts)
const createSale = vi.mocked(salesService.create)
const listMethods = vi.mocked(paymentMethodsService.list)
const whey = buildSellable()
const creatine = buildSellable({
  productId: 'product-creatine',
  name: 'Creatina 300 g',
  referenceCode: 'CREA-300',
  price: '99900.00',
  availableQuantity: 1,
  primaryImageUrl: 'https://cdn.example.com/creatina.webp',
})

function page(data: SellableProduct[]) {
  return { data, meta: { page: 1, limit: 12, total: data.length, totalPages: data.length ? 1 : 0 } }
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

function renderPage(path = '/pos') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <PosPage />
      <LocationProbe />
    </MemoryRouter>,
  )
  return { user, url: () => screen.getByTestId('location').textContent }
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.role = 'BRANCH_ASSISTANT'
  auth.branches = [{ id: 'branch-centro', name: 'Centro' }]
  sellable.mockResolvedValue(page([whey, creatine]))
  listMethods.mockResolvedValue(paymentMethodsPage([CASH, NEQUI]))
  createSale.mockResolvedValue(buildSale())
  vi.mocked(promotionsService.listApplicable).mockResolvedValue([])
  const empty = { data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } }
  vi.mocked(categoriesService.list).mockResolvedValue({
    data: [{ id: 'cat-protein', name: 'Proteínas', description: null, active: true }],
    meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
  } as never)
  vi.mocked(unitsService.list).mockResolvedValue(empty as never)
})

describe('PosPage', () => {
  it('shows each sellable product with price, stock and image', async () => {
    renderPage()

    const card = (await screen.findByText('Whey Protein 2 lb')).closest('li') as HTMLElement
    expect(within(card).getByText('$ 145.000')).toBeInTheDocument()
    expect(within(card).getByText('3 und disponibles')).toBeInTheDocument()
    expect(within(card).getByText('Sin imagen')).toBeInTheDocument()
    expect(sellable).toHaveBeenCalledWith(
      'branch-centro',
      { page: 1, limit: 12, search: undefined, categoryId: undefined },
      'test-token',
    )
  })

  it('adds products to the sale up to the available stock', async () => {
    const { user } = renderPage()
    await screen.findByText('Whey Protein 2 lb')

    await user.click(screen.getByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }))
    await user.click(screen.getByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }))
    await user.click(screen.getByRole('button', { name: 'Agregar Creatina 300 g a la venta' }))

    const selection = within(screen.getByRole('list', { name: 'Productos de la venta' }))
    expect(selection.getByText('Whey Protein 2 lb')).toBeInTheDocument()
    expect(screen.getByLabelText('2 en la venta')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Creatina 300 g: ya agregaste todas las unidades disponibles',
      }),
    ).toBeDisabled()
    expect(screen.getAllByText('$ 389.900')).toHaveLength(2)
  })

  it('changes and removes quantities from the selection', async () => {
    const { user } = renderPage()
    await screen.findByText('Whey Protein 2 lb')

    await user.click(screen.getByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }))
    await user.click(
      screen.getByRole('button', { name: 'Agregar una unidad de Whey Protein 2 lb' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Agregar una unidad de Whey Protein 2 lb' }),
    )
    expect(
      screen.getByRole('button', { name: 'Agregar una unidad de Whey Protein 2 lb' }),
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Quitar Whey Protein 2 lb de la venta' }))

    expect(screen.getByText(/Agrega productos desde el panel/)).toBeInTheDocument()
  })

  it('searches and filters by category', async () => {
    const { user } = renderPage()
    await screen.findByText('Whey Protein 2 lb')

    await user.type(screen.getByRole('searchbox', { name: /Buscar producto/ }), 'whey')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await user.selectOptions(screen.getByLabelText('Filtrar por categoría'), 'cat-protein')

    await waitFor(() =>
      expect(sellable).toHaveBeenLastCalledWith(
        'branch-centro',
        { page: 1, limit: 12, search: 'whey', categoryId: 'cat-protein' },
        'test-token',
      ),
    )
  })

  it('explains an empty branch', async () => {
    sellable.mockResolvedValue(page([]))
    renderPage()

    expect(await screen.findByText('Centro no tiene productos para vender')).toBeInTheDocument()
  })

  it('shows the error and retries', async () => {
    sellable.mockRejectedValueOnce(new ApiError('No', 403, {}, 'BRANCH_SCOPE_VIOLATION'))
    const { user } = renderPage()

    expect(await screen.findByText('No tienes acceso a esta sede.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Whey Protein 2 lb')).toBeInTheDocument()
  })

  it('lets the superadmin sell in any active branch', async () => {
    auth.role = 'SUPERADMIN'
    auth.branches = []
    const { branchesService } = await import('../../services/branches.service')
    vi.mocked(branchesService.list).mockResolvedValue({
      data: [
        { id: 'branch-norte', name: 'Norte', active: true, address: 'Calle 2', phone: '3' },
        { id: 'branch-sur', name: 'Sur', active: true, address: 'Calle 3', phone: '4' },
      ],
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    } as never)
    const { user } = renderPage()

    await user.selectOptions(await screen.findByLabelText('Sede'), 'branch-sur')
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )
    await waitFor(() => expect(screen.getByLabelText('Método de pago')).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Finalizar venta' }))
    await user.click(await screen.findByRole('button', { name: /Cobrar\s\$/ }))

    await waitFor(() =>
      expect(createSale).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'branch-sur' }),
        'test-token',
      ),
    )
  })

  it('types the quantity of a product within its stock', async () => {
    const { user } = renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )

    const quantity = screen.getByLabelText('Unidades de Whey Protein 2 lb')
    await user.clear(quantity)
    await user.type(quantity, '9')

    expect(quantity).toHaveValue('3')
    expect(screen.getAllByText('$ 435.000')).toHaveLength(2)
  })

  it('charges the sale with the chosen method and shows the ticket', async () => {
    const { user } = renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Agregar una unidad de Whey Protein 2 lb' }),
    )
    await waitFor(() => expect(screen.getByLabelText('Método de pago')).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('Método de pago'), 'pm-nequi')
    await user.type(screen.getByLabelText('Referencia del pago (opcional)'), ' NQ-123 ')
    await user.click(screen.getByRole('button', { name: 'Finalizar venta' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Confirmar venta' }))
    expect(dialog.getByText('Nequi · Ref. NQ-123')).toBeInTheDocument()
    await user.click(await dialog.findByRole('button', { name: /Cobrar\s\$\s290\.000/ }))

    expect(createSale).toHaveBeenCalledWith(
      {
        branchId: 'branch-centro',
        items: [{ productId: 'product-whey', quantity: 2 }],
        promotionId: null,
        payments: [{ paymentMethodId: 'pm-nequi', amount: '290000.00', reference: 'NQ-123' }],
      },
      'test-token',
    )
    const ticket = within(await screen.findByRole('dialog', { name: 'Venta registrada' }))
    expect(ticket.getByText('V-20261026-0001')).toBeInTheDocument()
    await user.click(ticket.getByRole('button', { name: 'Nueva venta' }))

    expect(screen.getByText(/Agrega productos desde el panel/)).toBeInTheDocument()
    expect(sellable).toHaveBeenCalledTimes(2)
  })

  it('lists the products without enough stock and keeps the sale', async () => {
    createSale.mockRejectedValueOnce(
      new ApiError(
        'Short',
        422,
        { items: [{ productName: 'Whey Protein 2 lb', requested: 1, available: 0 }] },
        'INSUFFICIENT_STOCK',
      ),
    )
    const { user } = renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )
    await waitFor(() => expect(screen.getByLabelText('Método de pago')).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Finalizar venta' }))
    await user.click(await screen.findByRole('button', { name: /Cobrar\s\$\s145\.000/ }))

    expect(await screen.findByText('Whey Protein 2 lb: pediste 1, quedan 0.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Confirmar venta' })).toBeInTheDocument()
  })

  it('asks for an active payment method before charging', async () => {
    listMethods.mockResolvedValue(paymentMethodsPage([]))
    const { user } = renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )

    expect(await screen.findByText(/No hay métodos de pago activos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalizar venta' })).toBeDisabled()
  })

  it('shows the active promotion in the sale totals', async () => {
    vi.mocked(promotionsService.listApplicable).mockResolvedValue([
      buildPromotion({ active: true, name: 'Black Friday', discountPercentage: '15.00' }),
    ])
    const { user } = renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )

    const selection = within(screen.getByRole('complementary', { name: 'Venta en curso' }))
    expect(await selection.findByText('Promoción Black Friday (15 %)')).toBeInTheDocument()
    expect(selection.getByText('−$ 21.750')).toBeInTheDocument()
    expect(selection.getByText('$ 123.250')).toBeInTheDocument()
    expect(promotionsService.listApplicable).toHaveBeenCalledWith('test-token')
  })

  it('does not ask for the promotion when the user only consults the products', async () => {
    auth.role = 'DEV'
    renderPage()

    await screen.findByText('Whey Protein 2 lb')
    expect(promotionsService.listApplicable).not.toHaveBeenCalled()
  })

  it('splits the payment between the active methods', async () => {
    const { user } = renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )
    await waitFor(() => expect(screen.getByLabelText('Método de pago')).toBeEnabled())

    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))

    const second = within(screen.getByRole('group', { name: 'Pago 2' }))
    expect(second.getByLabelText('Método de pago')).toHaveValue('pm-nequi')
    await user.type(second.getByLabelText('Monto'), '45000')
    expect(screen.getByText('Los pagos superan el total por $ 45.000.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir pago' })).not.toBeInTheDocument()
  })

  it('charges every payment of a split sale and starts the next one with a single payment', async () => {
    const { user } = renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )
    await waitFor(() => expect(screen.getByLabelText('Método de pago')).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))
    const first = within(screen.getByRole('group', { name: 'Pago 1' }))
    const second = within(screen.getByRole('group', { name: 'Pago 2' }))
    await user.clear(first.getByLabelText('Monto'))
    await user.type(first.getByLabelText('Monto'), '100.000')
    await user.type(second.getByLabelText('Monto'), '45000')
    await user.type(second.getByLabelText('Referencia del pago (opcional)'), 'NQ-5')
    await user.click(screen.getByRole('button', { name: 'Finalizar venta' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Confirmar venta' }))
    await user.click(await dialog.findByRole('button', { name: /Cobrar\s\$\s145\.000/ }))

    expect(createSale).toHaveBeenCalledWith(
      {
        branchId: 'branch-centro',
        items: [{ productId: 'product-whey', quantity: 1 }],
        promotionId: null,
        payments: [
          { paymentMethodId: 'pm-cash', amount: '100000.00', reference: null },
          { paymentMethodId: 'pm-nequi', amount: '45000.00', reference: 'NQ-5' },
        ],
      },
      'test-token',
    )
    const ticket = within(await screen.findByRole('dialog', { name: 'Venta registrada' }))
    await user.click(ticket.getByRole('button', { name: 'Nueva venta' }))
    expect(screen.getAllByRole('group', { name: /^Pago \d$/ })).toHaveLength(1)
    expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument()
  })

  it('blocks the charge when the split payments do not match the total', async () => {
    const { user } = renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )
    await waitFor(() => expect(screen.getByLabelText('Método de pago')).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))
    await user.type(
      within(screen.getByRole('group', { name: 'Pago 2' })).getByLabelText('Monto'),
      '5000',
    )
    await user.click(screen.getByRole('button', { name: 'Finalizar venta' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Confirmar venta' }))
    expect(await dialog.findByText(/Los pagos suman \$\s150\.000/)).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: /Cobrar\s\$\s145\.000/ })).toBeDisabled()
  })

  it('checks the active promotion again when the checkout opens', async () => {
    const listApplicable = vi.mocked(promotionsService.listApplicable)
    listApplicable
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildPromotion({ active: true, discountPercentage: '10.00' })])
    const { user } = renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )
    await waitFor(() => expect(screen.getByLabelText('Método de pago')).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Finalizar venta' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Confirmar venta' }))
    await user.click(await dialog.findByRole('button', { name: /Cobrar\s\$\s130\.500/ }))

    expect(listApplicable).toHaveBeenCalledTimes(2)
    expect(createSale).toHaveBeenCalledWith(
      expect.objectContaining({
        promotionId: 'promo-black-friday',
        payments: [{ paymentMethodId: 'pm-cash', amount: '130500.00', reference: null }],
      }),
      'test-token',
    )
  })

  it('charges a custom discount for a customer and resets it for the next sale', async () => {
    vi.mocked(promotionsService.listApplicable).mockResolvedValue([
      buildPromotion({ active: true, name: 'Black Friday', discountPercentage: '15.00' }),
    ])
    const { user } = renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )
    await waitFor(() =>
      expect(screen.getByLabelText('Descuento')).toHaveValue('promo:promo-black-friday'),
    )
    await user.selectOptions(screen.getByLabelText('Descuento'), 'custom')
    await user.click(screen.getByRole('radio', { name: 'Valor en pesos' }))
    await user.type(screen.getByLabelText('Valor del descuento'), '5.000')
    await user.type(screen.getByLabelText('Motivo del descuento'), 'Cliente frecuente')
    await user.click(screen.getByRole('button', { name: 'Finalizar venta' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Confirmar venta' }))
    await user.click(await dialog.findByRole('button', { name: /Cobrar\s\$\s140\.000/ }))

    expect(createSale).toHaveBeenCalledWith(
      expect.objectContaining({
        promotionId: null,
        discountAmount: '5000.00',
        discountReason: 'Cliente frecuente',
        payments: [{ paymentMethodId: 'pm-cash', amount: '140000.00', reference: null }],
      }),
      'test-token',
    )
    const ticket = within(await screen.findByRole('dialog', { name: 'Venta registrada' }))
    await user.click(ticket.getByRole('button', { name: 'Nueva venta' }))
    expect(screen.getByLabelText('Descuento')).toHaveValue('promo:promo-black-friday')
  })

  it('keeps the sale when the checkout is cancelled', async () => {
    const { user } = renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }),
    )
    await waitFor(() => expect(screen.getByLabelText('Método de pago')).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Finalizar venta' }))

    const dialog = within(await screen.findByRole('dialog', { name: 'Confirmar venta' }))
    await user.click(dialog.getByRole('button', { name: 'Seguir vendiendo' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Confirmar venta' })).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText('1 en la venta')).toBeInTheDocument()
    expect(createSale).not.toHaveBeenCalled()
  })

  it('shows the loading state while the products arrive', async () => {
    sellable.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando productos vendibles...')
  })

  it('reloads the products from the toolbar', async () => {
    const { user } = renderPage()
    await screen.findByText('Whey Protein 2 lb')

    sellable.mockReturnValue(new Promise(() => {}))
    await user.click(screen.getByRole('button', { name: 'Recargar' }))

    expect(await screen.findByRole('button', { name: 'Cargando...' })).toBeDisabled()
    expect(sellable).toHaveBeenCalledTimes(2)
  })

  it('changes the branch from the selector and keeps it in the url', async () => {
    auth.branches = [
      { id: 'branch-centro', name: 'Centro' },
      { id: 'branch-norte', name: 'Norte' },
    ]
    const { user, url } = renderPage('/pos?pagina=2')
    await screen.findByText('Whey Protein 2 lb')

    await user.selectOptions(screen.getByLabelText('Sede'), 'branch-norte')

    await waitFor(() =>
      expect(sellable).toHaveBeenLastCalledWith(
        'branch-norte',
        { page: 1, limit: 12, search: undefined, categoryId: undefined },
        'test-token',
      ),
    )
    expect(url()).toBe('/pos?sede=branch-norte')
  })

  it('discards the current sale when the branch changes', async () => {
    auth.branches = [
      { id: 'branch-centro', name: 'Centro' },
      { id: 'branch-norte', name: 'Norte' },
    ]
    const { user } = renderPage()
    await screen.findByText('Whey Protein 2 lb')
    await user.click(screen.getByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' }))
    expect(screen.getByLabelText('1 en la venta')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Sede'), 'branch-norte')

    expect(await screen.findByText(/Agrega productos desde el panel/)).toBeInTheDocument()
    expect(screen.queryByLabelText('1 en la venta')).not.toBeInTheDocument()
  })

  it('marks a product without remaining units', async () => {
    const { user } = renderPage()
    await screen.findByText('Whey Protein 2 lb')
    const add = () => screen.getByRole('button', { name: 'Agregar Whey Protein 2 lb a la venta' })

    await user.click(add())
    await user.click(add())
    await user.click(add())

    const exhausted = screen.getByRole('button', {
      name: 'Whey Protein 2 lb: ya agregaste todas las unidades disponibles',
    })
    expect(exhausted).toBeDisabled()
    expect(exhausted).toHaveTextContent('Sin más unidades')
  })

  it('paginates the products and resets the page when the size changes', async () => {
    sellable.mockResolvedValue({
      data: [whey],
      meta: { page: 1, limit: 12, total: 30, totalPages: 3 },
    })
    const { user } = renderPage()
    await screen.findByText('Whey Protein 2 lb')

    expect(screen.getByText('Mostrando 1–12 de 30')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Página 2 de 3' }))
    await waitFor(() =>
      expect(sellable).toHaveBeenLastCalledWith(
        'branch-centro',
        { page: 2, limit: 12, search: undefined, categoryId: undefined },
        'test-token',
      ),
    )

    await user.selectOptions(screen.getByLabelText('Filas por página'), '24')
    await waitFor(() =>
      expect(sellable).toHaveBeenLastCalledWith(
        'branch-centro',
        { page: 1, limit: 24, search: undefined, categoryId: undefined },
        'test-token',
      ),
    )
  })

  it('clears the filters from the empty result state', async () => {
    const { user } = renderPage()
    await screen.findByText('Whey Protein 2 lb')

    sellable.mockResolvedValue(page([]))
    await user.type(screen.getByRole('searchbox', { name: /Buscar producto/ }), 'zzz')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Ningún producto vendible coincide')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    await waitFor(() =>
      expect(sellable).toHaveBeenLastCalledWith(
        'branch-centro',
        { page: 1, limit: 12, search: undefined, categoryId: undefined },
        'test-token',
      ),
    )
  })

  it('offers every active category in the filter', async () => {
    renderPage()
    await screen.findByText('Whey Protein 2 lb')

    const filter = screen.getByLabelText('Filtrar por categoría')
    expect(within(filter).getByRole('option', { name: 'Todas las categorías' })).toBeInTheDocument()
    expect(within(filter).getByRole('option', { name: 'Proteínas' })).toBeInTheDocument()
  })

  it('explains when the branches cannot be loaded', async () => {
    auth.role = 'SUPERADMIN'
    auth.branches = []
    const { branchesService } = await import('../../services/branches.service')
    vi.mocked(branchesService.list)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({
        data: [{ id: 'branch-norte', name: 'Norte', active: true, address: 'Calle 2', phone: '3' }],
        meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
      } as never)
    const { user } = renderPage()

    expect(
      await screen.findByText('No fue posible cargar las sedes. Intenta de nuevo.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Whey Protein 2 lb')).toBeInTheDocument()
  })

  it('stops the superadmin without active branches', async () => {
    auth.role = 'SUPERADMIN'
    auth.branches = []
    const { branchesService } = await import('../../services/branches.service')
    vi.mocked(branchesService.list).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
    } as never)
    renderPage()

    expect(await screen.findByText('No tienes sedes activas asignadas')).toBeInTheDocument()
  })
})

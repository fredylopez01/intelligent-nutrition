import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { promotionsService } from '../../services/promotions.service'
import { salesService } from '../../services/sales.service'
import { CASH, NEQUI } from '../../test-utils/paymentMethods'
import { buildPromotion } from '../../test-utils/promotions'
import { buildSale, buildSellable } from '../../test-utils/sales'

import { CheckoutDialog } from './CheckoutDialog'
import type { SelectionLine } from './PosSelection'

vi.mock('../../services/sales.service', () => ({
  salesService: { create: vi.fn() },
}))

vi.mock('../../services/promotions.service', () => ({
  promotionsService: { getActive: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

const createSale = vi.mocked(salesService.create)
const getActive = vi.mocked(promotionsService.getActive)
const whey = buildSellable()
const blackFriday = buildPromotion({ active: true, discountPercentage: '15.00' })

const charge = (amount = '290\\.000') =>
  screen.findByRole('button', { name: new RegExp(`Cobrar\\s+\\$\\s+${amount}`) })

function renderDialog(
  lines: SelectionLine[] = [{ product: whey, quantity: 2 }],
  overrides: { reference?: string; paymentMethod?: typeof CASH } = {},
) {
  const onCompleted = vi.fn()
  const onStockChanged = vi.fn()
  const onCancel = vi.fn()
  const user = userEvent.setup()
  const { container } = render(
    <CheckoutDialog
      branch={{ id: 'branch-centro', name: 'Centro' }}
      lines={lines}
      paymentMethod={overrides.paymentMethod ?? CASH}
      reference={overrides.reference ?? ''}
      onCompleted={onCompleted}
      onStockChanged={onStockChanged}
      onCancel={onCancel}
    />,
  )
  return { user, onCompleted, onStockChanged, onCancel, container }
}

beforeEach(() => {
  vi.resetAllMocks()
  createSale.mockResolvedValue(buildSale())
  getActive.mockResolvedValue(null)
})

describe('CheckoutDialog', () => {
  it('lists each line with its quantity, unit price and total', async () => {
    const { container } = renderDialog()
    await charge()
    const lines = within(container.querySelector('.pos-checkout__lines') as HTMLElement)
    const summary = within(container.querySelector('.pos-checkout__summary') as HTMLElement)

    expect(lines.getByText('Whey Protein 2 lb')).toBeInTheDocument()
    expect(lines.getByText('2 × $ 145.000')).toBeInTheDocument()
    expect(lines.getByText('$ 290.000')).toBeInTheDocument()
    expect(summary.getByText('Centro')).toBeInTheDocument()
    expect(summary.getByText('Efectivo')).toBeInTheDocument()
    expect(summary.getByText('Total a cobrar')).toBeInTheDocument()
    expect(summary.getByText('$ 290.000')).toBeInTheDocument()
  })

  it('adds the reference to the payment line', async () => {
    renderDialog([{ product: whey, quantity: 2 }], { reference: 'NQ-1', paymentMethod: NEQUI })

    expect(await screen.findByText('Nequi · Ref. NQ-1')).toBeInTheDocument()
  })

  it('charges the exact payload of the sale', async () => {
    const { user, onCompleted } = renderDialog()

    await user.click(await charge())

    expect(createSale).toHaveBeenCalledWith(
      {
        branchId: 'branch-centro',
        items: [{ productId: 'product-whey', quantity: 2 }],
        payments: [{ paymentMethodId: 'pm-cash', amount: '290000.00', reference: null }],
      },
      'test-token',
    )
    expect(onCompleted).toHaveBeenCalledWith(buildSale())
  })

  it('sends the trimmed reference', async () => {
    const { user } = renderDialog([{ product: whey, quantity: 1 }], { reference: ' NQ-1 ' })

    await user.click(await charge('145\\.000'))

    expect(createSale).toHaveBeenCalledWith(
      expect.objectContaining({
        payments: [{ paymentMethodId: 'pm-cash', amount: '145000.00', reference: 'NQ-1' }],
      }),
      'test-token',
    )
  })

  it('shows the progress and confirms the sale', async () => {
    let resolve: (sale: ReturnType<typeof buildSale>) => void = () => {}
    createSale.mockReturnValue(new Promise((done) => (resolve = done)))
    const { user, onCompleted, onCancel } = renderDialog()

    await user.click(await charge())

    expect(screen.getByRole('button', { name: 'Registrando...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Seguir vendiendo' })).toBeDisabled()

    resolve(buildSale())

    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(buildSale()))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('lists the products without enough stock and asks for a refresh', async () => {
    createSale.mockRejectedValue(
      new ApiError(
        'Short',
        422,
        { items: [{ productName: 'Whey Protein 2 lb', requested: 1, available: 0 }] },
        'INSUFFICIENT_STOCK',
      ),
    )
    const { user, onCompleted, onStockChanged } = renderDialog()

    await user.click(await charge())

    expect(await screen.findByText('Whey Protein 2 lb: pediste 1, quedan 0.')).toBeInTheDocument()
    expect(onStockChanged).toHaveBeenCalled()
    expect(onCompleted).not.toHaveBeenCalled()
    expect(await charge()).toBeEnabled()
  })

  it('explains a generic failure without refreshing the stock', async () => {
    createSale.mockRejectedValue(new Error('boom'))
    const { user, onStockChanged } = renderDialog()

    await user.click(await charge())

    expect(
      await screen.findByText('No fue posible registrar la venta. Intenta de nuevo.'),
    ).toBeInTheDocument()
    expect(onStockChanged).not.toHaveBeenCalled()
  })

  it('asks for the active promotion when it opens and waits for it to charge', async () => {
    getActive.mockReturnValue(new Promise(() => {}))
    renderDialog()

    expect(getActive).toHaveBeenCalledWith('test-token')
    expect(screen.getByRole('status')).toHaveTextContent('Consultando promoción...')
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDisabled()
  })

  it('keeps the same flow and payload without an active promotion', async () => {
    const { user, container } = renderDialog()
    await user.click(await charge())

    const summary = within(container.querySelector('.pos-checkout__summary') as HTMLElement)
    expect(summary.queryByText('Subtotal')).not.toBeInTheDocument()
    expect(summary.queryByText(/Promoción/)).not.toBeInTheDocument()
    expect(createSale.mock.lastCall?.[0]).not.toHaveProperty('discountAmount')
  })

  it('shows the discount line and charges the total with the promotion', async () => {
    getActive.mockResolvedValue(blackFriday)
    const { user, container } = renderDialog()

    await user.click(await charge('246\\.500'))

    const summary = within(container.querySelector('.pos-checkout__summary') as HTMLElement)
    expect(summary.getByText('Subtotal')).toBeInTheDocument()
    expect(summary.getByText('$ 290.000')).toBeInTheDocument()
    expect(summary.getByText('Promoción Black Friday (15 %)')).toBeInTheDocument()
    expect(summary.getByText('−$ 43.500')).toBeInTheDocument()
    expect(summary.getByText('$ 246.500')).toBeInTheDocument()
    expect(createSale).toHaveBeenCalledWith(
      {
        branchId: 'branch-centro',
        items: [{ productId: 'product-whey', quantity: 2 }],
        payments: [{ paymentMethodId: 'pm-cash', amount: '246500.00', reference: null }],
      },
      'test-token',
    )
  })

  it('rounds the discount to the cent like the server', async () => {
    getActive.mockResolvedValue(buildPromotion({ active: true, discountPercentage: '12.50' }))
    const { user } = renderDialog([{ product: buildSellable({ price: '99999.99' }), quantity: 1 }])

    await user.click(await charge('87\\.499,99'))

    expect(createSale.mock.lastCall?.[0].payments).toEqual([
      { paymentMethodId: 'pm-cash', amount: '87499.99', reference: null },
    ])
  })

  it('blocks the charge until the promotion can be checked', async () => {
    getActive.mockRejectedValueOnce(new ApiError('down', 500)).mockResolvedValueOnce(null)
    const { user } = renderDialog()

    expect(
      await screen.findByText(/No fue posible consultar la promoción activa/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await charge()).toBeEnabled()
  })

  it('checks the promotion again when the server reports another total', async () => {
    createSale.mockRejectedValue(new ApiError('Mismatch', 422, {}, 'PAYMENT_TOTAL_MISMATCH'))
    getActive.mockResolvedValueOnce(blackFriday).mockResolvedValueOnce(null)
    const { user } = renderDialog()

    await user.click(await charge('246\\.500'))

    expect(
      await screen.findByText(/se actualizó un precio o la promoción activa/),
    ).toBeInTheDocument()
    expect(await charge()).toBeEnabled()
    expect(getActive).toHaveBeenCalledTimes(2)
  })

  it('keeps selling when the dialog is cancelled', async () => {
    const { user, onCancel } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Seguir vendiendo' }))

    expect(onCancel).toHaveBeenCalled()
    expect(createSale).not.toHaveBeenCalled()
  })
})

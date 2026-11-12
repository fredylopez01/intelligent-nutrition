import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { salesService } from '../../services/sales.service'
import { CASH, NEQUI } from '../../test-utils/paymentMethods'
import { buildPromotion } from '../../test-utils/promotions'
import { buildSale, buildSellable } from '../../test-utils/sales'
import type { Promotion } from '../../types/promotion'
import type { DiscountChoice } from '../../types/sale'
import { resolveDiscount, selectionTotalCents } from '../../utils/sales'

import { CheckoutDialog, type CheckoutPayment } from './CheckoutDialog'
import type { SelectionLine } from './PosSelection'

vi.mock('../../services/sales.service', () => ({
  salesService: { create: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

const createSale = vi.mocked(salesService.create)
const whey = buildSellable()
const blackFriday = buildPromotion({ active: true, discountPercentage: '15.00' })

const charge = (amount = '290\\.000') =>
  screen.getByRole('button', { name: new RegExp(`Cobrar\\s+\\$\\s+${amount}`) })

function cashPayment(overrides: Partial<CheckoutPayment> = {}): CheckoutPayment {
  return { paymentMethod: CASH, amount: '', reference: '', ...overrides }
}

interface DialogOptions {
  payments?: CheckoutPayment[]
  promotion?: Promotion | null
  promotionStatus?: 'loading' | 'success' | 'error'
  choice?: DiscountChoice | null
}

function renderDialog(
  lines: SelectionLine[] = [{ product: whey, quantity: 2 }],
  options: DialogOptions = {},
) {
  const onCompleted = vi.fn()
  const onStockChanged = vi.fn()
  const onCancel = vi.fn()
  const onReloadPromotions = vi.fn()
  const user = userEvent.setup()
  const { container } = render(
    <CheckoutDialog
      branch={{ id: 'branch-centro', name: 'Centro' }}
      lines={lines}
      payments={options.payments ?? [cashPayment()]}
      discount={resolveDiscount(
        options.choice ?? null,
        options.promotion ? [options.promotion] : [],
        selectionTotalCents(lines),
      )}
      promotionsStatus={options.promotionStatus ?? 'success'}
      onReloadPromotions={onReloadPromotions}
      onCompleted={onCompleted}
      onStockChanged={onStockChanged}
      onCancel={onCancel}
    />,
  )
  const summary = within(container.querySelector('.pos-checkout__summary') as HTMLElement)
  return { user, onCompleted, onStockChanged, onCancel, onReloadPromotions, container, summary }
}

beforeEach(() => {
  vi.resetAllMocks()
  createSale.mockResolvedValue(buildSale())
})

describe('CheckoutDialog', () => {
  it('lists each line with its quantity, unit price and total', () => {
    const { container, summary } = renderDialog()
    const lines = within(container.querySelector('.pos-checkout__lines') as HTMLElement)

    expect(lines.getByText('Whey Protein 2 lb')).toBeInTheDocument()
    expect(lines.getByText('2 × $ 145.000')).toBeInTheDocument()
    expect(lines.getByText('$ 290.000')).toBeInTheDocument()
    expect(summary.getByText('Centro')).toBeInTheDocument()
    expect(summary.getByText('Efectivo')).toBeInTheDocument()
    expect(summary.getByText('Total a cobrar')).toBeInTheDocument()
    expect(summary.getByText('$ 290.000')).toBeInTheDocument()
  })

  it('adds the reference to a single payment', () => {
    renderDialog(undefined, {
      payments: [cashPayment({ paymentMethod: NEQUI, reference: 'NQ-1' })],
    })

    expect(screen.getByText('Nequi · Ref. NQ-1')).toBeInTheDocument()
  })

  it('charges a single payment for the whole total', async () => {
    const { user, onCompleted } = renderDialog()

    await user.click(charge())

    expect(createSale).toHaveBeenCalledWith(
      {
        branchId: 'branch-centro',
        items: [{ productId: 'product-whey', quantity: 2 }],
        promotionId: null,
        payments: [{ paymentMethodId: 'pm-cash', amount: '290000.00', reference: null }],
      },
      'test-token',
    )
    expect(onCompleted).toHaveBeenCalledWith(buildSale())
  })

  it('sends the trimmed reference', async () => {
    const { user } = renderDialog([{ product: whey, quantity: 1 }], {
      payments: [cashPayment({ reference: ' NQ-1 ' })],
    })

    await user.click(charge('145\\.000'))

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

    await user.click(charge())

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

    await user.click(charge())

    expect(await screen.findByText('Whey Protein 2 lb: pediste 1, quedan 0.')).toBeInTheDocument()
    expect(onStockChanged).toHaveBeenCalled()
    expect(onCompleted).not.toHaveBeenCalled()
    expect(charge()).toBeEnabled()
  })

  it('explains a generic failure without refreshing the stock', async () => {
    createSale.mockRejectedValue(new Error('boom'))
    const { user, onStockChanged } = renderDialog()

    await user.click(charge())

    expect(
      await screen.findByText('No fue posible registrar la venta. Intenta de nuevo.'),
    ).toBeInTheDocument()
    expect(onStockChanged).not.toHaveBeenCalled()
  })

  it('keeps selling when the dialog is cancelled', async () => {
    const { user, onCancel } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Seguir vendiendo' }))

    expect(onCancel).toHaveBeenCalled()
    expect(createSale).not.toHaveBeenCalled()
  })
})

describe('CheckoutDialog promotion', () => {
  it('waits for the active promotion before charging', () => {
    renderDialog(undefined, { promotionStatus: 'loading', promotion: blackFriday })

    expect(screen.getByRole('status')).toHaveTextContent('Consultando promoción...')
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDisabled()
    expect(screen.queryByText(/Promoción Black Friday/)).not.toBeInTheDocument()
  })

  it('keeps the same flow and payload without an active promotion', async () => {
    const { user, summary } = renderDialog()

    await user.click(charge())

    expect(summary.queryByText('Subtotal')).not.toBeInTheDocument()
    expect(summary.queryByText(/Promoción/)).not.toBeInTheDocument()
    expect(createSale.mock.lastCall?.[0]).not.toHaveProperty('discountAmount')
    expect(createSale.mock.lastCall?.[0].promotionId).toBeNull()
  })

  it('shows the discount line and charges the total with the promotion', async () => {
    const { user, summary } = renderDialog(undefined, { promotion: blackFriday })

    await user.click(charge('246\\.500'))

    expect(summary.getByText('Subtotal')).toBeInTheDocument()
    expect(summary.getByText('$ 290.000')).toBeInTheDocument()
    expect(summary.getByText('Promoción Black Friday (15 %)')).toBeInTheDocument()
    expect(summary.getByText('−$ 43.500')).toBeInTheDocument()
    expect(summary.getByText('$ 246.500')).toBeInTheDocument()
    expect(createSale).toHaveBeenCalledWith(
      {
        branchId: 'branch-centro',
        items: [{ productId: 'product-whey', quantity: 2 }],
        promotionId: 'promo-black-friday',
        payments: [{ paymentMethodId: 'pm-cash', amount: '246500.00', reference: null }],
      },
      'test-token',
    )
  })

  it('rounds the discount to the cent like the server', async () => {
    const { user } = renderDialog(
      [{ product: buildSellable({ price: '99999.99' }), quantity: 1 }],
      {
        promotion: buildPromotion({ active: true, discountPercentage: '12.50' }),
      },
    )

    await user.click(charge('87\\.499,99'))

    expect(createSale.mock.lastCall?.[0].payments).toEqual([
      { paymentMethodId: 'pm-cash', amount: '87499.99', reference: null },
    ])
  })

  it('blocks the charge until the promotion can be checked', async () => {
    const { user, onReloadPromotions } = renderDialog(undefined, { promotionStatus: 'error' })

    expect(
      screen.getByText(/No fue posible consultar las promociones vigentes/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(onReloadPromotions).toHaveBeenCalled()
  })

  it('checks the promotion again when the server reports another total', async () => {
    createSale.mockRejectedValue(new ApiError('Mismatch', 422, {}, 'PAYMENT_TOTAL_MISMATCH'))
    const { user, onReloadPromotions } = renderDialog(undefined, { promotion: blackFriday })

    await user.click(charge('246\\.500'))

    expect(
      await screen.findByText(/se actualizó un precio o la promoción activa/),
    ).toBeInTheDocument()
    expect(onReloadPromotions).toHaveBeenCalled()
  })
})

describe('CheckoutDialog split payments', () => {
  const split = [
    cashPayment({ amount: '190.000' }),
    { paymentMethod: NEQUI, amount: '100000', reference: ' NQ-9 ' },
  ]

  it('lists every payment and sends the complete payments array', async () => {
    const { user, summary } = renderDialog(undefined, { payments: split })

    expect(summary.getByText('Pago 1 · Efectivo')).toBeInTheDocument()
    expect(summary.getByText('$ 190.000')).toBeInTheDocument()
    expect(summary.getByText('Pago 2 · Nequi · Ref. NQ-9')).toBeInTheDocument()
    expect(summary.getByText('$ 100.000')).toBeInTheDocument()
    await user.click(charge())

    expect(createSale).toHaveBeenCalledWith(
      {
        branchId: 'branch-centro',
        items: [{ productId: 'product-whey', quantity: 2 }],
        promotionId: null,
        payments: [
          { paymentMethodId: 'pm-cash', amount: '190000.00', reference: null },
          { paymentMethodId: 'pm-nequi', amount: '100000.00', reference: 'NQ-9' },
        ],
      },
      'test-token',
    )
  })

  it('blocks the charge when the payments do not add up to the total', () => {
    renderDialog(undefined, {
      payments: [cashPayment({ amount: '150000' }), { ...split[1], amount: '100000' }],
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Los pagos suman $ 250.000 y el total a cobrar es $ 290.000. Vuelve a la venta y ajusta los montos.',
    )
    expect(charge()).toBeDisabled()
  })

  it('compares the payments with the total after the promotion', async () => {
    const { user } = renderDialog(undefined, {
      promotion: blackFriday,
      payments: [cashPayment({ amount: '146500' }), { ...split[1], amount: '100000' }],
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(charge('246\\.500'))

    expect(createSale.mock.lastCall?.[0].payments.map((payment) => payment.amount)).toEqual([
      '146500.00',
      '100000.00',
    ])
  })

  it('blocks the charge when the promotion changed the total', () => {
    renderDialog(undefined, { promotion: blackFriday, payments: split })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Los pagos suman $ 290.000 y el total a cobrar es $ 246.500.',
    )
    expect(charge('246\\.500')).toBeDisabled()
  })

  it('asks for the amount of each payment', () => {
    renderDialog(undefined, {
      payments: [cashPayment({ amount: '290000' }), { ...split[1], amount: '' }],
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Hay pagos sin un monto válido.')
    expect(screen.getByText('Sin monto')).toBeInTheDocument()
    expect(charge()).toBeDisabled()
  })
})

describe('CheckoutDialog chosen discount', () => {
  it('sells without discount when the seller removes the active promotion', async () => {
    const { user, summary } = renderDialog(undefined, {
      promotion: blackFriday,
      choice: { kind: 'none' },
    })

    await user.click(charge())

    expect(summary.queryByText(/Promoción/)).not.toBeInTheDocument()
    expect(createSale.mock.lastCall?.[0]).toMatchObject({
      promotionId: null,
      payments: [{ amount: '290000.00' }],
    })
  })

  it('does not wait for the promotions when there is no promotion to apply', () => {
    renderDialog(undefined, { promotionStatus: 'loading', choice: { kind: 'none' } })

    expect(charge()).toBeEnabled()
  })

  it('sends the custom discount with its reason and no promotion', async () => {
    const { user, summary } = renderDialog(undefined, {
      promotion: blackFriday,
      choice: { kind: 'custom', type: 'percentage', value: '10', reason: ' Cliente frecuente ' },
    })

    expect(
      summary.getByText('Descuento personalizado (10 %) · Cliente frecuente'),
    ).toBeInTheDocument()
    expect(summary.getByText('−$ 29.000')).toBeInTheDocument()
    await user.click(charge('261\\.000'))

    expect(createSale).toHaveBeenCalledWith(
      {
        branchId: 'branch-centro',
        items: [{ productId: 'product-whey', quantity: 2 }],
        promotionId: null,
        discountAmount: '29000.00',
        discountReason: 'Cliente frecuente',
        payments: [{ paymentMethodId: 'pm-cash', amount: '261000.00', reference: null }],
      },
      'test-token',
    )
  })

  it('blocks the charge when the chosen promotion is no longer valid', () => {
    renderDialog(undefined, { choice: { kind: 'promotion', promotionId: 'promo-old' } })

    expect(
      screen.getByText('La promoción elegida ya no está vigente. Elige otro descuento.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDisabled()
  })

  it('reloads the promotions when the server rejects the chosen one', async () => {
    createSale.mockRejectedValue(new ApiError('Old', 422, {}, 'PROMOTION_NOT_APPLICABLE'))
    const { user, onReloadPromotions } = renderDialog(undefined, { promotion: blackFriday })

    await user.click(charge('246\\.500'))

    expect(
      await screen.findByText('La promoción elegida ya no está vigente. Elige otro descuento.'),
    ).toBeInTheDocument()
    expect(onReloadPromotions).toHaveBeenCalled()
  })
})

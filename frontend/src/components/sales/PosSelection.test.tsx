import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { CASH, NEQUI } from '../../test-utils/paymentMethods'
import { buildPromotion } from '../../test-utils/promotions'
import { buildSellable } from '../../test-utils/sales'
import type { PaymentMethod } from '../../types/paymentMethod'
import type { Promotion } from '../../types/promotion'
import type { PaymentDraft } from '../../types/sale'
import { createPaymentDraft } from '../../utils/sales'

import { PosSelection, type SelectionLine } from './PosSelection'

const whey = buildSellable()
const creatine = buildSellable({
  productId: 'product-creatine',
  name: 'Creatina 300 g',
  referenceCode: 'CREA-300',
  price: '99900.00',
  availableQuantity: 1,
})
const DAVIPLATA: PaymentMethod = {
  id: 'pm-daviplata',
  code: 'DAVIPLATA',
  name: 'Daviplata',
  active: true,
}

interface SelectionOptions {
  promotion?: Promotion | null
  paymentMethods?: PaymentMethod[]
  payments?: PaymentDraft[]
}

function renderSelection(lines: SelectionLine[] = [], options: SelectionOptions = {}) {
  const onChangeQuantity = vi.fn()
  const onRemove = vi.fn()
  const onClear = vi.fn()
  const onCheckout = vi.fn()
  const onPaymentsChange = vi.fn()
  const user = userEvent.setup()

  function Harness() {
    const [payments, setPayments] = useState<PaymentDraft[]>(
      options.payments ?? [createPaymentDraft(CASH.id)],
    )
    return (
      <PosSelection
        lines={lines}
        onChangeQuantity={onChangeQuantity}
        onRemove={onRemove}
        onClear={onClear}
        promotion={options.promotion ?? null}
        paymentMethods={options.paymentMethods ?? [CASH, NEQUI]}
        paymentStatus="success"
        payments={payments}
        onPaymentsChange={(next) => {
          onPaymentsChange(next)
          setPayments(next)
        }}
        onRetryPaymentMethods={vi.fn()}
        onCheckout={onCheckout}
      />
    )
  }

  const { container } = render(<Harness />)
  const lastPayments = (): PaymentDraft[] => onPaymentsChange.mock.lastCall?.[0] ?? []
  return { user, onChangeQuantity, onRemove, onClear, onCheckout, container, lastPayments }
}

function balance(container: HTMLElement) {
  return container.querySelector('.pos-balance') as HTMLElement | null
}

describe('PosSelection', () => {
  it('explains the empty sale and hides the clear action', () => {
    renderSelection()

    expect(screen.getByText(/Agrega productos desde el panel/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vaciar' })).not.toBeInTheDocument()
  })

  it('lists each line with its unit price and line total', () => {
    renderSelection([{ product: whey, quantity: 2 }])

    expect(screen.getByText('Whey Protein 2 lb')).toBeInTheDocument()
    expect(screen.getByText('$ 145.000 c/u · $ 290.000')).toBeInTheDocument()
  })

  it('adds up the units and the total', () => {
    const { container } = renderSelection([
      { product: whey, quantity: 2 },
      { product: creatine, quantity: 1 },
    ])
    const totals = within(container.querySelector('.pos-selection__totals') as HTMLElement)

    expect(totals.getByText('Unidades')).toBeInTheDocument()
    expect(totals.getByText('3')).toBeInTheDocument()
    expect(totals.getByText('Total')).toBeInTheDocument()
    expect(totals.getByText('$ 389.900')).toBeInTheDocument()
  })

  it('increments a line', async () => {
    const { user, onChangeQuantity } = renderSelection([{ product: whey, quantity: 1 }])

    await user.click(
      screen.getByRole('button', { name: 'Agregar una unidad de Whey Protein 2 lb' }),
    )

    expect(onChangeQuantity).toHaveBeenCalledWith('product-whey', 2)
  })

  it('disables the increment at the available stock', () => {
    renderSelection([{ product: whey, quantity: 3 }])

    expect(
      screen.getByRole('button', { name: 'Agregar una unidad de Whey Protein 2 lb' }),
    ).toBeDisabled()
  })

  it('decrements a line above one unit', async () => {
    const { user, onChangeQuantity, onRemove } = renderSelection([{ product: whey, quantity: 2 }])

    await user.click(screen.getByRole('button', { name: 'Quitar una unidad de Whey Protein 2 lb' }))

    expect(onChangeQuantity).toHaveBeenCalledWith('product-whey', 1)
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('removes the line when decrementing from one unit', async () => {
    const { user, onChangeQuantity, onRemove } = renderSelection([{ product: whey, quantity: 1 }])

    await user.click(screen.getByRole('button', { name: 'Quitar una unidad de Whey Protein 2 lb' }))

    expect(onRemove).toHaveBeenCalledWith('product-whey')
    expect(onChangeQuantity).not.toHaveBeenCalled()
  })

  it('removes a line from its close button', async () => {
    const { user, onRemove } = renderSelection([{ product: whey, quantity: 2 }])

    await user.click(screen.getByRole('button', { name: 'Quitar Whey Protein 2 lb de la venta' }))

    expect(onRemove).toHaveBeenCalledWith('product-whey')
  })

  it('clears the whole sale', async () => {
    const { user, onClear } = renderSelection([{ product: whey, quantity: 1 }])

    await user.click(screen.getByRole('button', { name: 'Vaciar' }))

    expect(onClear).toHaveBeenCalled()
  })

  it('reminds that the system confirms the total when the sale is registered', () => {
    renderSelection([{ product: whey, quantity: 1 }])

    expect(
      screen.getByText(/El sistema confirma el total y descuenta el stock/),
    ).toBeInTheDocument()
  })
})

describe('PosSelection promotion', () => {
  it('shows the promotion discount and the total to charge', () => {
    const { container } = renderSelection([{ product: whey, quantity: 2 }], {
      promotion: buildPromotion({
        active: true,
        name: 'Black Friday',
        discountPercentage: '15.00',
      }),
    })
    const totals = within(container.querySelector('.pos-selection__totals') as HTMLElement)

    expect(totals.getByText('Subtotal')).toBeInTheDocument()
    expect(totals.getByText('$ 290.000')).toBeInTheDocument()
    expect(totals.getByText('Black Friday (15 %)')).toBeInTheDocument()
    expect(totals.getByText('−$ 43.500')).toBeInTheDocument()
    expect(totals.getByText('$ 246.500')).toBeInTheDocument()
  })

  it('keeps the totals unchanged without a promotion', () => {
    const { container } = renderSelection([{ product: whey, quantity: 2 }])
    const totals = within(container.querySelector('.pos-selection__totals') as HTMLElement)

    expect(totals.queryByText('Subtotal')).not.toBeInTheDocument()
  })
})

describe('PosSelection payments', () => {
  it('starts with a single payment for the whole total and no amount field', () => {
    const { container } = renderSelection([{ product: whey, quantity: 2 }])

    expect(screen.getAllByRole('group', { name: /^Pago \d$/ })).toHaveLength(1)
    expect(screen.getByLabelText('Método de pago')).toHaveValue('pm-cash')
    expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar el pago/ })).not.toBeInTheDocument()
    expect(balance(container)).toBeNull()
  })

  it('adds a payment with the next method and splits the amounts', async () => {
    const { user, container, lastPayments } = renderSelection([{ product: whey, quantity: 2 }])

    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))

    const first = within(screen.getByRole('group', { name: 'Pago 1' }))
    const second = within(screen.getByRole('group', { name: 'Pago 2' }))
    expect(first.getByLabelText('Monto')).toHaveValue('290000')
    expect(second.getByLabelText('Método de pago')).toHaveValue('pm-nequi')
    expect(second.getByLabelText('Monto')).toHaveValue('')
    expect(balance(container)).toHaveTextContent('Escribe el monto de cada pago.')

    await user.clear(first.getByLabelText('Monto'))
    await user.type(first.getByLabelText('Monto'), '190.000')
    await user.type(second.getByLabelText('Monto'), '100000')

    expect(balance(container)).toHaveTextContent('Los pagos cubren el total.')
    expect(balance(container)).toHaveClass('pos-balance--ok')
    expect(
      lastPayments().map(({ paymentMethodId, amount }) => ({ paymentMethodId, amount })),
    ).toEqual([
      { paymentMethodId: 'pm-cash', amount: '190.000' },
      { paymentMethodId: 'pm-nequi', amount: '100000' },
    ])
  })

  it('warns when the payments do not match the total and adjusts the first one', async () => {
    const { user, container } = renderSelection([{ product: whey, quantity: 2 }])
    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))
    const second = within(screen.getByRole('group', { name: 'Pago 2' }))

    await user.type(second.getByLabelText('Monto'), '50000')

    expect(balance(container)).toHaveClass('pos-balance--off')
    expect(balance(container)).toHaveTextContent('Los pagos superan el total por $ 50.000.')
    await user.click(screen.getByRole('button', { name: /Ajustar el pago 1 a \$\s240\.000/ }))

    expect(
      within(screen.getByRole('group', { name: 'Pago 1' })).getByLabelText('Monto'),
    ).toHaveValue('240000')
    expect(balance(container)).toHaveTextContent('Los pagos cubren el total.')
  })

  it('says how much is missing', async () => {
    const { user, container } = renderSelection([{ product: whey, quantity: 2 }])
    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))
    const first = within(screen.getByRole('group', { name: 'Pago 1' }))
    const second = within(screen.getByRole('group', { name: 'Pago 2' }))

    await user.clear(first.getByLabelText('Monto'))
    await user.type(first.getByLabelText('Monto'), '100000')
    await user.type(second.getByLabelText('Monto'), '90000')

    expect(balance(container)).toHaveTextContent('Faltan $ 100.000 por asignar.')
    expect(balance(container)).toHaveTextContent('Asignado$ 190.000')
  })

  it('compares the payments against the total with the promotion', async () => {
    const { user, container } = renderSelection([{ product: whey, quantity: 2 }], {
      promotion: buildPromotion({ active: true, discountPercentage: '15.00' }),
    })

    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))

    expect(
      within(screen.getByRole('group', { name: 'Pago 1' })).getByLabelText('Monto'),
    ).toHaveValue('246500')
    const second = within(screen.getByRole('group', { name: 'Pago 2' }))
    await user.type(second.getByLabelText('Monto'), '46500')
    expect(balance(container)).toHaveTextContent('Ajustar el pago 1 a $ 200.000')
  })

  it('rejects an amount that is not a number', async () => {
    const { user } = renderSelection([{ product: whey, quantity: 2 }])
    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))
    const second = within(screen.getByRole('group', { name: 'Pago 2' }))

    await user.type(second.getByLabelText('Monto'), 'abc')

    expect(
      second.getByText('Escribe un monto mayor que 0, por ejemplo 50.000.'),
    ).toBeInTheDocument()
  })

  it('removes a payment and goes back to a single payment for the total', async () => {
    const { user, container } = renderSelection([{ product: whey, quantity: 2 }])
    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))

    await user.click(screen.getByRole('button', { name: 'Quitar el pago 2' }))

    expect(screen.getAllByRole('group', { name: /^Pago \d$/ })).toHaveLength(1)
    expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument()
    expect(balance(container)).toBeNull()
  })

  it('offers each method only once and stops adding when all are used', async () => {
    const { user } = renderSelection([{ product: whey, quantity: 2 }], {
      paymentMethods: [CASH, NEQUI, DAVIPLATA],
    })

    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))
    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))

    const third = within(screen.getByRole('group', { name: 'Pago 3' }))
    expect(third.getByLabelText('Método de pago')).toHaveValue('pm-daviplata')
    const options = within(third.getByLabelText('Método de pago'))
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).not.toContain('Efectivo')
    expect(options).not.toContain('Nequi')
    expect(screen.queryByRole('button', { name: 'Añadir pago' })).not.toBeInTheDocument()
  })

  it('does not offer a second payment before adding products', () => {
    renderSelection()

    expect(screen.queryByRole('button', { name: 'Añadir pago' })).not.toBeInTheDocument()
  })

  it('keeps a reference for each payment', async () => {
    const { user, lastPayments } = renderSelection([{ product: whey, quantity: 2 }])
    await user.click(screen.getByRole('button', { name: 'Añadir pago' }))
    const second = within(screen.getByRole('group', { name: 'Pago 2' }))

    await user.type(second.getByLabelText('Referencia del pago (opcional)'), 'NQ-77')

    expect(lastPayments()[1].reference).toBe('NQ-77')
    expect(lastPayments()[0].reference).toBe('')
  })

  it('asks for a method before finishing the sale', () => {
    renderSelection([{ product: whey, quantity: 1 }], { payments: [createPaymentDraft('')] })

    expect(screen.getByRole('button', { name: 'Finalizar venta' })).toBeDisabled()
  })

  it('finishes the sale with every payment ready', async () => {
    const { user, onCheckout } = renderSelection([{ product: whey, quantity: 1 }])

    await user.click(screen.getByRole('button', { name: 'Finalizar venta' }))

    expect(onCheckout).toHaveBeenCalled()
  })
})

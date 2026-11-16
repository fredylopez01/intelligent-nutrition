import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { onlineOrdersService } from '../../services/onlineOrders.service'
import { paymentMethodsService } from '../../services/paymentMethods.service'
import { buildOrder } from '../../test-utils/onlineOrders'
import { buildSale } from '../../test-utils/sales'
import type { OnlineOrder } from '../../types/onlineOrder'
import { downloadSaleReceipt } from '../../utils/pdf/saleReceiptPdf'

import { OnlineOrderDetail } from './OnlineOrderDetail'

vi.mock('../../services/onlineOrders.service', () => ({
  onlineOrdersService: { updateStatus: vi.fn(), complete: vi.fn() },
}))

vi.mock('../../services/paymentMethods.service', () => ({
  paymentMethodsService: { list: vi.fn() },
}))

vi.mock('../../utils/pdf/saleReceiptPdf', () => ({
  downloadSaleReceipt: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

const updateStatus = vi.mocked(onlineOrdersService.updateStatus)
const complete = vi.mocked(onlineOrdersService.complete)

function renderDetail(order: OnlineOrder = buildOrder()) {
  const onChanged = vi.fn()
  const onCompleted = vi.fn()
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(
    <OnlineOrderDetail
      order={order}
      onChanged={onChanged}
      onCompleted={onCompleted}
      onClose={onClose}
    />,
  )
  return { user, onChanged, onCompleted, onClose }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(paymentMethodsService.list).mockResolvedValue({
    data: [{ id: 'pm-nequi', code: 'NEQUI', name: 'Nequi', active: true }],
    meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
  } as never)
})

describe('OnlineOrderDetail', () => {
  it('shows the customer, the pickup branch, the hold and a WhatsApp link to the customer', () => {
    renderDetail()

    expect(screen.getByText('P-20261114-0001')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText(/Vence en (46|47) h/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /3114827719 · Escribir por WhatsApp/ }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/573114827719?text=Hola%20Camilo'),
    )
    expect(screen.getByText('Sede Makro · Av. Universitaria, Tunja')).toBeInTheDocument()
  })

  it('confirms a pending order', async () => {
    updateStatus.mockResolvedValue(buildOrder({ status: 'CONFIRMED' }))
    const { user, onChanged } = renderDetail()

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

    expect(updateStatus).toHaveBeenCalledWith('order-1', { status: 'CONFIRMED' }, 'test-token')
    expect(onChanged).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CONFIRMED' }),
      'El pedido P-20261114-0001 quedó confirmado.',
    )
  })

  it('marks a confirmed delivery as out for delivery', async () => {
    updateStatus.mockResolvedValue(buildOrder({ status: 'OUT_FOR_DELIVERY' }))
    const { user } = renderDetail(
      buildOrder({
        status: 'CONFIRMED',
        fulfillment: 'DELIVERY',
        delivery: { address: 'Calle 19 # 9-35', neighborhood: 'Centro' },
      }),
    )

    expect(screen.getByText('Calle 19 # 9-35, Centro, Tunja')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Marcar en camino' }))

    expect(updateStatus).toHaveBeenCalledWith(
      'order-1',
      { status: 'OUT_FOR_DELIVERY' },
      'test-token',
    )
  })

  it('asks for the reason before cancelling', async () => {
    updateStatus.mockResolvedValue(buildOrder({ status: 'CANCELLED' }))
    const { user, onChanged } = renderDetail()

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }))
    expect(screen.getByText('Escribe el motivo de la cancelación.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Motivo de la cancelación'), 'No respondió')
    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }))

    expect(updateStatus).toHaveBeenCalledWith(
      'order-1',
      { status: 'CANCELLED', reason: 'No respondió' },
      'test-token',
    )
    expect(onChanged).toHaveBeenCalledWith(
      expect.anything(),
      'El pedido P-20261114-0001 quedó cancelado y sus unidades se liberaron.',
    )
  })

  it('confirms the purchase with the payment method and offers the receipt', async () => {
    const sale = buildSale({ saleNumber: 'V-20261114-0003', total: '679800.00' })
    complete.mockResolvedValue({ order: buildOrder({ status: 'DELIVERED' }), sale })
    const { user, onCompleted } = renderDetail()

    await user.click(screen.getByRole('button', { name: 'Confirmar compra' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar compra' }))
    expect(screen.getByText('Elige el método con el que pagó el cliente.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('option', { name: 'Nequi' })).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText('Método de pago'), 'pm-nequi')
    await user.type(screen.getByLabelText('Referencia (opcional)'), 'NQ-55')
    await user.click(screen.getByRole('button', { name: 'Confirmar compra' }))

    expect(complete).toHaveBeenCalledWith(
      'order-1',
      { paymentMethodId: 'pm-nequi', reference: 'NQ-55' },
      'test-token',
    )
    expect(
      await screen.findByText(/Compra confirmada con la venta V-20261114-0003/),
    ).toBeInTheDocument()
    expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ status: 'DELIVERED' }), sale)
    await user.click(screen.getByRole('button', { name: 'Descargar comprobante' }))
    expect(downloadSaleReceipt).toHaveBeenCalledWith(sale)
  })

  it('explains an expired hold', async () => {
    updateStatus.mockRejectedValue(new ApiError('Conflict', 409, undefined, 'ORDER_EXPIRED'))
    const { user } = renderDetail()

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

    expect(await screen.findByText(/La reserva de este pedido venció/)).toBeInTheDocument()
  })

  it('only offers to close a finished order', () => {
    renderDetail(
      buildOrder({
        status: 'DELIVERED',
        sale: { id: 'sale-1', saleNumber: 'V-20261114-0003', total: '679800.00' },
      }),
    )

    expect(screen.getByText('V-20261114-0003 · $ 679.800')).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Cerrar'])
  })
})

import { useState } from 'react'
import type { FormEvent } from 'react'

import { useActivePaymentMethods } from '../../hooks/useActivePaymentMethods'
import { useAuth } from '../../hooks/useAuth'
import { onlineOrdersService } from '../../services/onlineOrders.service'
import type { ManualOrderStatus, OnlineOrder } from '../../types/onlineOrder'
import type { Sale } from '../../types/sale'
import { whatsappUrl } from '../../utils/contact'
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  customerWhatsappMessage,
  formatOrderDate,
  holdLabel,
  isOpenOrder,
  nextOrderActions,
  resolveOrderError,
} from '../../utils/onlineOrders'
import { downloadSaleReceipt } from '../../utils/pdf/saleReceiptPdf'
import { formatPrice } from '../../utils/products'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { DownloadPdfButton } from '../ui/DownloadPdfButton'

import '../users/StatusBadge.css'
import './OnlineOrders.css'

type Mode = 'view' | 'cancel' | 'complete'

interface OnlineOrderDetailProps {
  order: OnlineOrder
  onChanged: (order: OnlineOrder, message: string) => void
  onCompleted: (order: OnlineOrder, sale: Sale) => void
  onClose: () => void
}

export function OnlineOrderDetail({
  order,
  onChanged,
  onCompleted,
  onClose,
}: OnlineOrderDetailProps) {
  const { token } = useAuth()
  const [mode, setMode] = useState<Mode>('view')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [reference, setReference] = useState('')
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const payments = useActivePaymentMethods(mode === 'complete')
  const open = isOpenOrder(order)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(resolveOrderError(err, 'No fue posible actualizar el pedido. Intenta de nuevo.'))
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = (status: ManualOrderStatus, label: string) =>
    run(async () => {
      const updated = await onlineOrdersService.updateStatus(order.id, { status }, token)
      onChanged(updated, `El pedido ${order.code} quedó ${label.toLowerCase()}.`)
    })

  const cancel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reason.trim()) {
      setError('Escribe el motivo de la cancelación.')
      return
    }
    void run(async () => {
      const updated = await onlineOrdersService.updateStatus(
        order.id,
        { status: 'CANCELLED', reason: reason.trim() },
        token,
      )
      onChanged(updated, `El pedido ${order.code} quedó cancelado y sus unidades se liberaron.`)
    })
  }

  const complete = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!paymentMethodId) {
      setError('Elige el método con el que pagó el cliente.')
      return
    }
    void run(async () => {
      const result = await onlineOrdersService.complete(
        order.id,
        { paymentMethodId, ...(reference.trim() ? { reference: reference.trim() } : {}) },
        token,
      )
      setCompletedSale(result.sale)
      onCompleted(result.order, result.sale)
    })
  }

  if (completedSale) {
    return (
      <div className="order-detail">
        <Alert tone="success">
          Compra confirmada con la venta {completedSale.saleNumber} por{' '}
          {formatPrice(completedSale.total)}. El pedido quedó entregado.
        </Alert>
        <div className="order-detail__actions">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <DownloadPdfButton
            label="Descargar comprobante"
            onDownload={() => downloadSaleReceipt(completedSale)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="order-detail">
      <div className="order-detail__head">
        <div>
          <p className="order-detail__code">{order.code}</p>
          <p className="order-detail__meta">
            {formatOrderDate(order.createdAt)} · {FULFILLMENT_LABELS[order.fulfillment]} ·{' '}
            {order.branch.name}
          </p>
        </div>
        <span className={`ui-status ui-status--${ORDER_STATUS_TONES[order.status]}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <dl className="order-detail__facts">
        <div>
          <dt>Cliente</dt>
          <dd>
            {order.customer.name}
            <span className="order-detail__hint">
              {order.customer.registered ? 'Cliente registrado' : 'Sin registro'}
              {order.customer.email ? ` · ${order.customer.email}` : ''}
            </span>
          </dd>
        </div>
        <div>
          <dt>Celular</dt>
          <dd>
            <a
              className="order-detail__whatsapp"
              href={whatsappUrl(order.customer.phone, customerWhatsappMessage(order))}
              target="_blank"
              rel="noreferrer noopener"
            >
              {order.customer.phone} · Escribir por WhatsApp
            </a>
          </dd>
        </div>
        <div>
          <dt>{order.fulfillment === 'DELIVERY' ? 'Entregar en' : 'Recoge en'}</dt>
          <dd>
            {order.fulfillment === 'DELIVERY'
              ? `${order.delivery?.address}, ${order.delivery?.neighborhood}, Tunja`
              : `${order.branch.name} · ${order.branch.address}`}
            {order.fulfillment === 'DELIVERY' && (
              <span className="order-detail__hint">
                Sale desde {order.branch.name}. El valor del domicilio se acuerda por WhatsApp.
              </span>
            )}
          </dd>
        </div>
        {order.status === 'PENDING' && (
          <div>
            <dt>Reserva</dt>
            <dd>{holdLabel(order)}</dd>
          </div>
        )}
        {order.notes && (
          <div>
            <dt>Notas</dt>
            <dd>{order.notes}</dd>
          </div>
        )}
        {order.cancelReason && (
          <div>
            <dt>Motivo de cancelación</dt>
            <dd>{order.cancelReason}</dd>
          </div>
        )}
        {order.sale && (
          <div>
            <dt>Venta</dt>
            <dd>
              {order.sale.saleNumber} · {formatPrice(order.sale.total)}
            </dd>
          </div>
        )}
      </dl>

      <table className="order-detail__items">
        <caption className="sr-only">Productos del pedido</caption>
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col" className="orders-table__number">
              Cant.
            </th>
            <th scope="col" className="orders-table__number">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.productId}>
              <td>
                {item.name}
                <span className="orders-table__meta">
                  {item.referenceCode} · {formatPrice(item.unitPrice)} c/u
                </span>
              </td>
              <td className="orders-table__number">{item.quantity}</td>
              <td className="orders-table__number">{formatPrice(item.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>
              Total productos
            </th>
            <td className="orders-table__number">{formatPrice(order.subtotal)}</td>
          </tr>
        </tfoot>
      </table>

      {error && <Alert tone="error">{error}</Alert>}

      {mode === 'cancel' && (
        <form className="order-detail__form" onSubmit={cancel} noValidate>
          <label className="ui-field__label" htmlFor="order-cancel-reason">
            Motivo de la cancelación
          </label>
          <textarea
            id="order-cancel-reason"
            className="ui-field__control order-detail__textarea"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="order-detail__actions">
            <Button variant="outline" onClick={() => setMode('view')} disabled={busy}>
              Volver
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? 'Cancelando...' : 'Cancelar pedido'}
            </Button>
          </div>
        </form>
      )}

      {mode === 'complete' && (
        <form className="order-detail__form" onSubmit={complete} noValidate>
          <p className="order-detail__hint">
            Se registra la venta en {order.branch.name} con los precios actuales y un solo pago por
            el total. Descuenta el inventario y queda en el historial de Ventas.
          </p>
          <div className="order-detail__fields">
            <div className="ui-field">
              <label className="ui-field__label" htmlFor="order-payment-method">
                Método de pago
              </label>
              <select
                id="order-payment-method"
                className="ui-field__control"
                value={paymentMethodId}
                onChange={(event) => setPaymentMethodId(event.target.value)}
              >
                <option value="">
                  {payments.status === 'loading' ? 'Cargando métodos...' : 'Elige el método'}
                </option>
                {payments.paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label className="ui-field__label" htmlFor="order-payment-reference">
                Referencia (opcional)
              </label>
              <input
                id="order-payment-reference"
                className="ui-field__control"
                maxLength={100}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </div>
          </div>
          <div className="order-detail__actions">
            <Button variant="outline" onClick={() => setMode('view')} disabled={busy}>
              Volver
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Registrando venta...' : 'Confirmar compra'}
            </Button>
          </div>
        </form>
      )}

      {mode === 'view' && (
        <div className="order-detail__actions">
          {open && (
            <Button variant="ghost" onClick={() => setMode('cancel')} disabled={busy}>
              Cancelar pedido
            </Button>
          )}
          {nextOrderActions(order).map((action) => (
            <Button
              key={action.status}
              variant="outline"
              disabled={busy}
              onClick={() => void changeStatus(action.status, ORDER_STATUS_LABELS[action.status])}
            >
              {action.label}
            </Button>
          ))}
          {open && (
            <Button onClick={() => setMode('complete')} disabled={busy}>
              Confirmar compra
            </Button>
          )}
          {!open && (
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

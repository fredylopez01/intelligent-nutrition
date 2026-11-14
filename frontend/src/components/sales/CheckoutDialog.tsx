import { useState } from 'react'

import { useAuth } from '../../hooks/useAuth'
import { ApiError } from '../../services/http'
import { salesService } from '../../services/sales.service'
import type { Customer } from '../../types/customer'
import type { PaymentMethod } from '../../types/paymentMethod'
import type { Sale } from '../../types/sale'
import { formatPrice } from '../../utils/products'
import {
  centsToAmount,
  discountReady,
  paymentsBalance,
  resolveSaleError,
  selectionTotalCents,
  stockShortages,
  type ResolvedDiscount,
  type StockShortage,
} from '../../utils/sales'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

import { CheckoutCustomer } from './CheckoutCustomer'
import type { SelectionLine } from './PosSelection'

import './PointOfSale.css'

export interface CheckoutPayment {
  paymentMethod: PaymentMethod
  amount: string
  reference: string
}

interface CheckoutDialogProps {
  branch: { id: string; name: string }
  lines: SelectionLine[]
  payments: CheckoutPayment[]
  discount: ResolvedDiscount
  promotionsStatus: 'loading' | 'success' | 'error'
  onReloadPromotions: () => void
  onCompleted: (sale: Sale) => void
  onStockChanged: () => void
  onCancel: () => void
}

export function CheckoutDialog({
  branch,
  lines,
  payments,
  discount,
  promotionsStatus,
  onReloadPromotions,
  onCompleted,
  onStockChanged,
  onCancel,
}: CheckoutDialogProps) {
  const { token } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<{ message: string; shortages: StockShortage[] } | null>(null)
  const [withCustomer, setWithCustomer] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const customerReady = !withCustomer || customer !== null
  const promotionsLoading = discount.needsPromotions && promotionsStatus === 'loading'
  const promotionsFailed = discount.needsPromotions && promotionsStatus === 'error'
  const totalReady = !promotionsLoading && !promotionsFailed && discountReady(discount)
  const subtotalCents = selectionTotalCents(lines)
  const discountCents = discount.cents
  const totalCents = subtotalCents - discountCents
  const discountLabel =
    discount.kind === 'custom' && discount.payload.discountReason
      ? `${discount.label} · ${discount.payload.discountReason}`
      : discount.label
  const balance = paymentsBalance(payments, totalCents)
  const isSplit = payments.length > 1
  const canCharge = totalReady && balance.matches && customerReady && !submitting

  const confirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const sale = await salesService.create(
        {
          branchId: branch.id,
          ...(withCustomer && customer ? { customerId: customer.id } : {}),
          items: lines.map((line) => ({
            productId: line.product.productId,
            quantity: line.quantity,
          })),
          ...discount.payload,
          payments: payments.map((payment, index) => ({
            paymentMethodId: payment.paymentMethod.id,
            amount: centsToAmount(balance.amounts[index] ?? 0),
            reference: payment.reference.trim() || null,
          })),
        },
        token,
      )
      onCompleted(sale)
    } catch (caught) {
      const shortages = stockShortages(caught)
      if (shortages.length > 0) onStockChanged()
      if (
        caught instanceof ApiError &&
        (caught.code === 'PAYMENT_TOTAL_MISMATCH' || caught.code === 'PROMOTION_NOT_APPLICABLE')
      ) {
        onReloadPromotions()
      }
      setError({
        message: resolveSaleError(caught, 'No fue posible registrar la venta. Intenta de nuevo.'),
        shortages,
      })
      setSubmitting(false)
    }
  }

  const mismatchMessage = !balance.complete
    ? 'Hay pagos sin un monto válido. Vuelve a la venta y escribe el monto de cada pago.'
    : `Los pagos suman ${formatPrice(balance.assignedCents / 100)} y el total a cobrar es ${formatPrice(totalCents / 100)}. Vuelve a la venta y ajusta los montos.`

  return (
    <div className="pos-checkout">
      {error && (
        <Alert tone="error">
          {error.message}
          {error.shortages.length > 0 && (
            <ul className="pos-checkout__shortages">
              {error.shortages.map((shortage) => (
                <li key={shortage.productName}>
                  {shortage.productName}: pediste {shortage.requested}, quedan {shortage.available}.
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <ul className="pos-checkout__lines" aria-label="Resumen de la venta">
        {lines.map(({ product, quantity }) => (
          <li key={product.productId} className="pos-checkout__line">
            <span className="pos-checkout__name">
              {product.name}
              <span className="pos-checkout__meta">
                {quantity} × {formatPrice(product.price)}
              </span>
            </span>
            <span className="pos-checkout__amount">
              {formatPrice(Number(product.price) * quantity)}
            </span>
          </li>
        ))}
      </ul>

      <fieldset className="pos-checkout__customer">
        <legend className="sr-only">Cliente de la venta</legend>
        <label className="pos-checkout__customer-toggle">
          <input
            type="checkbox"
            checked={withCustomer}
            onChange={(event) => setWithCustomer(event.target.checked)}
          />
          <strong>Factura con datos del cliente</strong>
          <small>
            Asocia la venta a un cliente registrado. La factura sale con su documento, correo,
            teléfono y dirección, lista para la factura electrónica.
          </small>
        </label>
        {withCustomer && <CheckoutCustomer customer={customer} onChange={setCustomer} />}
        {withCustomer && !customer && (
          <p className="pos-checkout__customer-hint">
            Elige o registra el cliente para poder cobrar.
          </p>
        )}
      </fieldset>

      {discount.promotionError && !promotionsLoading && !promotionsFailed && (
        <Alert tone="error">{discount.promotionError}</Alert>
      )}

      {promotionsFailed && (
        <div className="pos-checkout__promotion-error">
          <Alert tone="error">
            No fue posible consultar las promociones vigentes, así que no sabemos el total exacto.
          </Alert>
          <Button variant="outline" onClick={onReloadPromotions}>
            Reintentar
          </Button>
        </div>
      )}

      <dl className="pos-checkout__summary">
        <div>
          <dt>Sede</dt>
          <dd>{branch.name}</dd>
        </div>
        {isSplit ? (
          payments.map((payment, index) => (
            <div key={`${payment.paymentMethod.id}-${index}`}>
              <dt>
                Pago {index + 1} · {payment.paymentMethod.name}
                {payment.reference.trim() ? ` · Ref. ${payment.reference.trim()}` : ''}
              </dt>
              <dd className="pos-checkout__figure">
                {balance.amounts[index] === null
                  ? 'Sin monto'
                  : formatPrice((balance.amounts[index] ?? 0) / 100)}
              </dd>
            </div>
          ))
        ) : (
          <div>
            <dt>Pago</dt>
            <dd>
              {payments[0].paymentMethod.name}
              {payments[0].reference.trim() ? ` · Ref. ${payments[0].reference.trim()}` : ''}
            </dd>
          </div>
        )}
        {totalReady && discountCents > 0 && (
          <>
            <div>
              <dt>Subtotal</dt>
              <dd className="pos-checkout__figure">{formatPrice(subtotalCents / 100)}</dd>
            </div>
            <div className="pos-checkout__discount">
              <dt>{discountLabel}</dt>
              <dd className="pos-checkout__figure">−{formatPrice(discountCents / 100)}</dd>
            </div>
          </>
        )}
        <div className="pos-checkout__total">
          <dt>Total a cobrar</dt>
          <dd>
            {promotionsLoading ? (
              <span className="pos-checkout__pending" role="status">
                Consultando promoción...
              </span>
            ) : (
              formatPrice(totalCents / 100)
            )}
          </dd>
        </div>
      </dl>

      {totalReady && !balance.matches && (
        <p className="pos-checkout__mismatch" role="alert">
          {mismatchMessage}
        </p>
      )}

      <p className="pos-selection__note">
        Al confirmar se descuentan las unidades de los lotes que vencen primero y la venta queda
        registrada a tu nombre.
        {totalReady && discount.kind === 'promotion'
          ? ' El sistema aplica la promoción elegida al registrar la venta.'
          : ''}
      </p>

      <div className="pos-checkout__actions">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Seguir vendiendo
        </Button>
        <Button onClick={() => void confirm()} disabled={!canCharge}>
          {submitting
            ? 'Registrando...'
            : totalReady
              ? `Cobrar ${formatPrice(totalCents / 100)}`
              : 'Cobrar'}
        </Button>
      </div>
    </div>
  )
}

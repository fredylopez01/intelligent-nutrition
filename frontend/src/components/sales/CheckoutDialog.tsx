import { useState } from 'react'

import { useActivePromotion } from '../../hooks/useActivePromotion'
import { useAuth } from '../../hooks/useAuth'
import { ApiError } from '../../services/http'
import { salesService } from '../../services/sales.service'
import type { PaymentMethod } from '../../types/paymentMethod'
import type { Sale } from '../../types/sale'
import { formatPrice } from '../../utils/products'
import { formatPercentage } from '../../utils/promotions'
import {
  centsToAmount,
  promotionDiscountCents,
  resolveSaleError,
  selectionTotalCents,
  stockShortages,
  type StockShortage,
} from '../../utils/sales'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

import type { SelectionLine } from './PosSelection'

import './PointOfSale.css'

interface CheckoutDialogProps {
  branch: { id: string; name: string }
  lines: SelectionLine[]
  paymentMethod: PaymentMethod
  reference: string
  onCompleted: (sale: Sale) => void
  onStockChanged: () => void
  onCancel: () => void
}

export function CheckoutDialog({
  branch,
  lines,
  paymentMethod,
  reference,
  onCompleted,
  onStockChanged,
  onCancel,
}: CheckoutDialogProps) {
  const { token } = useAuth()
  const activePromotion = useActivePromotion()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<{ message: string; shortages: StockShortage[] } | null>(null)
  const promotion = activePromotion.promotion
  const subtotalCents = selectionTotalCents(lines)
  const discountCents = promotionDiscountCents(subtotalCents, promotion?.discountPercentage)
  const totalCents = subtotalCents - discountCents
  const trimmedReference = reference.trim()
  const promotionReady = activePromotion.status === 'success'

  const confirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const sale = await salesService.create(
        {
          branchId: branch.id,
          items: lines.map((line) => ({
            productId: line.product.productId,
            quantity: line.quantity,
          })),
          payments: [
            {
              paymentMethodId: paymentMethod.id,
              amount: centsToAmount(totalCents),
              reference: trimmedReference || null,
            },
          ],
        },
        token,
      )
      onCompleted(sale)
    } catch (caught) {
      const shortages = stockShortages(caught)
      if (shortages.length > 0) onStockChanged()
      if (caught instanceof ApiError && caught.code === 'PAYMENT_TOTAL_MISMATCH') {
        activePromotion.reload()
      }
      setError({
        message: resolveSaleError(caught, 'No fue posible registrar la venta. Intenta de nuevo.'),
        shortages,
      })
      setSubmitting(false)
    }
  }

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

      {activePromotion.status === 'error' && (
        <div className="pos-checkout__promotion-error">
          <Alert tone="error">
            No fue posible consultar la promoción activa, así que no sabemos el total exacto.
          </Alert>
          <Button variant="outline" onClick={activePromotion.reload}>
            Reintentar
          </Button>
        </div>
      )}

      <dl className="pos-checkout__summary">
        <div>
          <dt>Sede</dt>
          <dd>{branch.name}</dd>
        </div>
        <div>
          <dt>Pago</dt>
          <dd>
            {paymentMethod.name}
            {trimmedReference ? ` · Ref. ${trimmedReference}` : ''}
          </dd>
        </div>
        {promotion && (
          <>
            <div>
              <dt>Subtotal</dt>
              <dd className="pos-checkout__figure">{formatPrice(subtotalCents / 100)}</dd>
            </div>
            <div className="pos-checkout__discount">
              <dt>
                Promoción {promotion.name} ({formatPercentage(promotion.discountPercentage)})
              </dt>
              <dd className="pos-checkout__figure">−{formatPrice(discountCents / 100)}</dd>
            </div>
          </>
        )}
        <div className="pos-checkout__total">
          <dt>Total a cobrar</dt>
          <dd>
            {activePromotion.status === 'loading' ? (
              <span className="pos-checkout__pending" role="status">
                Consultando promoción...
              </span>
            ) : (
              formatPrice(totalCents / 100)
            )}
          </dd>
        </div>
      </dl>

      <p className="pos-selection__note">
        Al confirmar se descuentan las unidades de los lotes que vencen primero y la venta queda
        registrada a tu nombre.
        {promotion ? ' El sistema aplica la promoción activa al registrar la venta.' : ''}
      </p>

      <div className="pos-checkout__actions">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Seguir vendiendo
        </Button>
        <Button onClick={() => void confirm()} disabled={submitting || !promotionReady}>
          {submitting
            ? 'Registrando...'
            : promotionReady
              ? `Cobrar ${formatPrice(totalCents / 100)}`
              : 'Cobrar'}
        </Button>
      </div>
    </div>
  )
}

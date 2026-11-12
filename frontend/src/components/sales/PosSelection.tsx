import type { PaymentMethod } from '../../types/paymentMethod'
import type { Promotion } from '../../types/promotion'
import type { PaymentDraft, SellableProduct } from '../../types/sale'
import { formatPrice } from '../../utils/products'
import { formatPercentage } from '../../utils/promotions'
import {
  PAYMENT_REFERENCE_MAX_LENGTH,
  centsToInput,
  createPaymentDraft,
  paymentsBalance,
  promotionDiscountCents,
  selectionTotalCents,
} from '../../utils/sales'
import { Button } from '../ui/Button'
import { SelectField } from '../ui/SelectField'
import { TextField } from '../ui/TextField'

import './PointOfSale.css'

export interface SelectionLine {
  product: SellableProduct
  quantity: number
}

interface PosSelectionProps {
  lines: SelectionLine[]
  onChangeQuantity: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
  onClear: () => void
  promotion: Promotion | null
  paymentMethods: PaymentMethod[]
  paymentStatus: 'loading' | 'success' | 'error'
  payments: PaymentDraft[]
  onPaymentsChange: (payments: PaymentDraft[]) => void
  onRetryPaymentMethods: () => void
  onCheckout: () => void
}

export function PosSelection({
  lines,
  onChangeQuantity,
  onRemove,
  onClear,
  promotion,
  paymentMethods,
  paymentStatus,
  payments,
  onPaymentsChange,
  onRetryPaymentMethods,
  onCheckout,
}: PosSelectionProps) {
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const subtotalCents = selectionTotalCents(lines)
  const discountCents = promotionDiscountCents(subtotalCents, promotion?.discountPercentage)
  const totalCents = subtotalCents - discountCents
  const noMethods = paymentStatus === 'success' && paymentMethods.length === 0
  const isSplit = payments.length > 1
  const balance = paymentsBalance(payments, totalCents)
  const usedMethodIds = new Set(payments.map((payment) => payment.paymentMethodId))
  const canAddPayment =
    lines.length > 0 && paymentStatus === 'success' && payments.length < paymentMethods.length
  const missingMethod = payments.some((payment) => !payment.paymentMethodId)

  const updatePayment = (id: string, changes: Partial<PaymentDraft>) =>
    onPaymentsChange(
      payments.map((payment) => (payment.id === id ? { ...payment, ...changes } : payment)),
    )

  const addPayment = () => {
    const nextMethod = paymentMethods.find((method) => !usedMethodIds.has(method.id))
    const current = isSplit
      ? payments
      : payments.map((payment) => ({ ...payment, amount: centsToInput(totalCents) }))
    const remaining = paymentsBalance(current, totalCents).differenceCents
    onPaymentsChange([
      ...current,
      createPaymentDraft(nextMethod?.id ?? '', remaining > 0 ? centsToInput(remaining) : ''),
    ])
  }

  const removePayment = (id: string) => {
    const rest = payments.filter((payment) => payment.id !== id)
    onPaymentsChange(rest.length === 1 ? [{ ...rest[0], amount: '' }] : rest)
  }

  const adjustFirstPayment = () => {
    const [first] = payments
    const firstCents = balance.amounts[0] ?? 0
    updatePayment(first.id, { amount: centsToInput(firstCents + balance.differenceCents) })
  }

  const firstAdjusted = (balance.amounts[0] ?? 0) + balance.differenceCents

  const balanceMessage = () => {
    if (!balance.complete) return 'Escribe el monto de cada pago.'
    if (balance.differenceCents > 0) {
      return `Faltan ${formatPrice(balance.differenceCents / 100)} por asignar.`
    }
    if (balance.differenceCents < 0) {
      return `Los pagos superan el total por ${formatPrice(-balance.differenceCents / 100)}.`
    }
    return 'Los pagos cubren el total.'
  }

  return (
    <aside className="pos-selection" aria-labelledby="pos-selection-title">
      <div className="pos-selection__head">
        <h2 id="pos-selection-title" className="pos-selection__title">
          Venta en curso
        </h2>
        {lines.length > 0 && (
          <button type="button" className="pos-selection__clear" onClick={onClear}>
            Vaciar
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="pos-selection__empty">
          Agrega productos desde el panel. Solo aparecen los que tienen unidades vigentes en la
          sede.
        </p>
      ) : (
        <ul className="pos-selection__lines" aria-label="Productos de la venta">
          {lines.map(({ product, quantity }) => (
            <li key={product.productId} className="pos-selection__line">
              <div className="pos-selection__info">
                <span className="pos-selection__name">{product.name}</span>
                <span className="pos-selection__unit-price">
                  {formatPrice(product.price)} c/u · {formatPrice(Number(product.price) * quantity)}
                </span>
              </div>
              <div
                className="pos-selection__stepper"
                role="group"
                aria-label={`Cantidad de ${product.name}`}
              >
                <button
                  type="button"
                  aria-label={`Quitar una unidad de ${product.name}`}
                  onClick={() =>
                    quantity <= 1
                      ? onRemove(product.productId)
                      : onChangeQuantity(product.productId, quantity - 1)
                  }
                >
                  −
                </button>
                <input
                  className="pos-selection__quantity"
                  aria-label={`Unidades de ${product.name}`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={quantity}
                  onChange={(event) => {
                    const next = Number(event.target.value.replace(/\D/g, ''))
                    if (next > 0) onChangeQuantity(product.productId, next)
                  }}
                  onFocus={(event) => event.target.select()}
                />
                <button
                  type="button"
                  aria-label={`Agregar una unidad de ${product.name}`}
                  onClick={() => onChangeQuantity(product.productId, quantity + 1)}
                  disabled={quantity >= product.availableQuantity}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="pos-selection__remove"
                aria-label={`Quitar ${product.name} de la venta`}
                onClick={() => onRemove(product.productId)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <dl className="pos-selection__totals">
        <div>
          <dt>Unidades</dt>
          <dd>{units}</dd>
        </div>
        {promotion && (
          <>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPrice(subtotalCents / 100)}</dd>
            </div>
            <div className="pos-selection__discount">
              <dt>
                {promotion.name} ({formatPercentage(promotion.discountPercentage)})
              </dt>
              <dd>−{formatPrice(discountCents / 100)}</dd>
            </div>
          </>
        )}
        <div className="pos-selection__total">
          <dt>Total</dt>
          <dd>{formatPrice(totalCents / 100)}</dd>
        </div>
      </dl>

      <fieldset className="pos-selection__payment">
        <legend className={isSplit ? 'pos-selection__legend' : 'sr-only'}>
          {isSplit ? 'Pagos' : 'Pago'}
        </legend>
        {payments.map((payment, index) => {
          const number = index + 1
          const options = paymentMethods
            .filter(
              (method) => method.id === payment.paymentMethodId || !usedMethodIds.has(method.id),
            )
            .map((method) => ({ value: method.id, label: method.name }))
          const amountCents = balance.amounts[index]
          return (
            <div
              key={payment.id}
              className={isSplit ? 'pos-payment pos-payment--split' : 'pos-payment'}
              role="group"
              aria-label={`Pago ${number}`}
            >
              {isSplit && (
                <div className="pos-payment__head">
                  <span className="pos-payment__title">Pago {number}</span>
                  <button
                    type="button"
                    className="pos-selection__remove"
                    aria-label={`Quitar el pago ${number}`}
                    onClick={() => removePayment(payment.id)}
                  >
                    ×
                  </button>
                </div>
              )}
              <SelectField
                id={`pos-payment-method-${payment.id}`}
                label="Método de pago"
                placeholder={
                  paymentStatus === 'loading' ? 'Cargando métodos...' : 'Elige el método'
                }
                options={options}
                value={payment.paymentMethodId}
                onChange={(event) =>
                  updatePayment(payment.id, { paymentMethodId: event.target.value })
                }
                disabled={paymentStatus !== 'success' || noMethods}
              />
              {isSplit && (
                <TextField
                  id={`pos-payment-amount-${payment.id}`}
                  label="Monto"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Ej. 50.000"
                  value={payment.amount}
                  onChange={(event) => updatePayment(payment.id, { amount: event.target.value })}
                  hint={
                    amountCents !== null && amountCents !== undefined
                      ? formatPrice(amountCents / 100)
                      : undefined
                  }
                  error={
                    payment.amount.trim() && amountCents === null
                      ? 'Escribe un monto mayor que 0, por ejemplo 50.000.'
                      : undefined
                  }
                />
              )}
              <TextField
                id={`pos-payment-reference-${payment.id}`}
                label="Referencia del pago (opcional)"
                placeholder="Ej. número de la transferencia"
                autoComplete="off"
                maxLength={PAYMENT_REFERENCE_MAX_LENGTH}
                value={payment.reference}
                onChange={(event) => updatePayment(payment.id, { reference: event.target.value })}
              />
            </div>
          )
        })}

        {paymentStatus === 'error' && (
          <p className="pos-selection__note" role="alert">
            No fue posible cargar los métodos de pago.{' '}
            <button type="button" className="pos-selection__clear" onClick={onRetryPaymentMethods}>
              Reintentar
            </button>
          </p>
        )}
        {noMethods && (
          <p className="pos-selection__note" role="alert">
            No hay métodos de pago activos. Pide al superadmin que active uno.
          </p>
        )}

        {isSplit && lines.length > 0 && (
          <div
            className={`pos-balance ${balance.matches ? 'pos-balance--ok' : 'pos-balance--off'}`}
            role="status"
          >
            <dl className="pos-balance__figures">
              <div>
                <dt>Asignado</dt>
                <dd>{formatPrice(balance.assignedCents / 100)}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{formatPrice(totalCents / 100)}</dd>
              </div>
            </dl>
            <p className="pos-balance__message">{balanceMessage()}</p>
            {balance.complete && balance.differenceCents !== 0 && firstAdjusted > 0 && (
              <button type="button" className="pos-selection__clear" onClick={adjustFirstPayment}>
                Ajustar el pago 1 a {formatPrice(firstAdjusted / 100)}
              </button>
            )}
          </div>
        )}

        {canAddPayment && (
          <Button variant="outline" onClick={addPayment}>
            Añadir pago
          </Button>
        )}
      </fieldset>

      <Button onClick={onCheckout} disabled={lines.length === 0 || missingMethod}>
        Finalizar venta
      </Button>
      <p className="pos-selection__note">
        Precios vigentes de la sede. El sistema confirma el total y descuenta el stock al registrar
        la venta.
      </p>
    </aside>
  )
}

import type { Promotion } from '../../types/promotion'
import type { CustomDiscountType, DiscountChoice } from '../../types/sale'
import { formatPercentage } from '../../utils/promotions'
import { DISCOUNT_REASON_MAX_LENGTH, type ResolvedDiscount } from '../../utils/sales'
import { SelectField } from '../ui/SelectField'
import { TextField } from '../ui/TextField'

import './PointOfSale.css'

interface DiscountPickerProps {
  promotions: Promotion[]
  promotionsStatus: 'loading' | 'success' | 'error'
  choice: DiscountChoice | null
  discount: ResolvedDiscount
  disabled?: boolean
  onChange: (choice: DiscountChoice) => void
  onRetryPromotions: () => void
}

const NONE = 'none'
const CUSTOM = 'custom'
const PROMOTION_PREFIX = 'promo:'

const CUSTOM_TYPES: { value: CustomDiscountType; label: string }[] = [
  { value: 'percentage', label: 'Porcentaje' },
  { value: 'amount', label: 'Valor en pesos' },
]

export function DiscountPicker({
  promotions,
  promotionsStatus,
  choice,
  discount,
  disabled = false,
  onChange,
  onRetryPromotions,
}: DiscountPickerProps) {
  const selected =
    discount.kind === 'custom'
      ? CUSTOM
      : discount.kind === 'promotion'
        ? `${PROMOTION_PREFIX}${discount.payload.promotionId ?? ''}`
        : NONE
  const missingPromotion = discount.kind === 'promotion' && discount.promotion === null
  const options = [
    { value: NONE, label: 'Sin descuento' },
    ...promotions.map((promotion) => ({
      value: `${PROMOTION_PREFIX}${promotion.id}`,
      label: `${promotion.name} · ${formatPercentage(promotion.discountPercentage)}${promotion.active ? ' (activa)' : ''}`,
    })),
    ...(missingPromotion ? [{ value: selected, label: 'Promoción que ya no está vigente' }] : []),
    { value: CUSTOM, label: 'Descuento personalizado' },
  ]
  const custom = choice?.kind === 'custom' ? choice : null

  const select = (value: string) => {
    if (value === NONE) onChange({ kind: 'none' })
    else if (value === CUSTOM)
      onChange({ kind: 'custom', type: 'percentage', value: '', reason: '' })
    else onChange({ kind: 'promotion', promotionId: value.slice(PROMOTION_PREFIX.length) })
  }

  return (
    <div className="pos-discount">
      <SelectField
        id="pos-discount"
        label="Descuento"
        options={options}
        value={selected}
        onChange={(event) => select(event.target.value)}
        disabled={disabled}
        error={discount.promotionError ?? undefined}
        hint={
          promotionsStatus === 'loading'
            ? 'Consultando las promociones vigentes...'
            : promotionsStatus === 'success' && promotions.length === 0
              ? 'No hay promociones vigentes hoy. Puedes aplicar un descuento personalizado.'
              : undefined
        }
      />
      {promotionsStatus === 'error' && (
        <p className="pos-selection__note" role="alert">
          No fue posible cargar las promociones.{' '}
          <button type="button" className="pos-selection__clear" onClick={onRetryPromotions}>
            Reintentar
          </button>
        </p>
      )}

      {custom && (
        <div className="pos-discount__custom">
          <div className="pos-discount__types" role="radiogroup" aria-label="Tipo de descuento">
            {CUSTOM_TYPES.map((type) => (
              <label
                key={type.value}
                className={`pos-discount__type${custom.type === type.value ? ' pos-discount__type--on' : ''}`}
              >
                <input
                  type="radio"
                  name="pos-discount-type"
                  value={type.value}
                  checked={custom.type === type.value}
                  onChange={() => onChange({ ...custom, type: type.value })}
                />
                {type.label}
              </label>
            ))}
          </div>
          <TextField
            id="pos-discount-value"
            label={custom.type === 'percentage' ? 'Porcentaje (%)' : 'Valor del descuento'}
            inputMode="decimal"
            autoComplete="off"
            placeholder={custom.type === 'percentage' ? 'Ej. 10' : 'Ej. 10.000'}
            value={custom.value}
            onChange={(event) => onChange({ ...custom, value: event.target.value })}
            error={custom.value.trim() ? (discount.valueError ?? undefined) : undefined}
          />
          <TextField
            id="pos-discount-reason"
            label="Motivo del descuento"
            placeholder="Ej. Cliente frecuente"
            autoComplete="off"
            maxLength={DISCOUNT_REASON_MAX_LENGTH}
            value={custom.reason}
            onChange={(event) => onChange({ ...custom, reason: event.target.value })}
            hint="Queda registrado en la venta."
            error={
              custom.value.trim() && !discount.valueError
                ? (discount.reasonError ?? undefined)
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}

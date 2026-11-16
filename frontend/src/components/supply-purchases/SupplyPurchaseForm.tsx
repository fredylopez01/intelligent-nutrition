import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../../hooks/useAuth'
import type { SupplierOption } from '../../hooks/useSupplierOptions'
import { suppliesService } from '../../services/supplies.service'
import { supplyPurchasesService } from '../../services/supplyPurchases.service'
import type { Supply } from '../../types/supply'
import type { SupplyPurchase } from '../../types/supplyPurchase'
import { formatPrice, isValidPrice, toPriceString } from '../../utils/products'
import {
  lineSubtotalCents,
  parseQuantity,
  resolveSupplyPurchaseError,
} from '../../utils/supplyPurchases'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

import './SupplyPurchases.css'

interface Line {
  key: number
  supplyId: string
  quantity: string
  unitCost: string
}

interface SupplyPurchaseFormProps {
  suppliers: SupplierOption[]
  onCreated: (purchase: SupplyPurchase) => void
  onCancel: () => void
}

let lineKey = 0
const emptyLine = (): Line => ({ key: (lineKey += 1), supplyId: '', quantity: '', unitCost: '' })

export function SupplyPurchaseForm({ suppliers, onCreated, onCancel }: SupplyPurchaseFormProps) {
  const { token } = useAuth()
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [observation, setObservation] = useState('')
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()])
  const [showErrors, setShowErrors] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    suppliesService
      .list({ page: 1, limit: 100, active: true }, token)
      .then((response) => {
        if (!cancelled) setSupplies(response.data)
      })
      .catch(() => {
        if (!cancelled) setSupplies([])
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const unitOf = (supplyId: string) =>
    supplies.find((supply) => supply.id === supplyId)?.unitOfMeasure.abbreviation ?? ''
  const lineErrors = lines.map((line, index) => {
    if (!line.supplyId) return 'Elige el insumo.'
    if (lines.findIndex((other) => other.supplyId === line.supplyId) !== index) {
      return 'Este insumo ya está en la compra.'
    }
    if (parseQuantity(line.quantity) === null) return 'Escribe una cantidad mayor que 0.'
    if (!isValidPrice(line.unitCost)) return 'Escribe el costo unitario, ej. 4200 o 4.20.'
    return null
  })
  const totalCents = lines.reduce((sum, line) => {
    const quantity = parseQuantity(line.quantity)
    return quantity !== null && isValidPrice(line.unitCost)
      ? sum + lineSubtotalCents(quantity, toPriceString(line.unitCost))
      : sum
  }, 0)

  const update = (key: number, field: keyof Omit<Line, 'key'>, value: string) =>
    setLines((previous) =>
      previous.map((line) => (line.key === key ? { ...line, [field]: value } : line)),
    )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    if (!supplierId || lineErrors.some(Boolean)) {
      setShowErrors(true)
      return
    }
    setSubmitting(true)
    try {
      const purchase = await supplyPurchasesService.create(
        {
          supplierId,
          ...(observation.trim() ? { observation: observation.trim() } : {}),
          items: lines.map((line) => ({
            supplyId: line.supplyId,
            quantity: parseQuantity(line.quantity) ?? 0,
            unitCost: toPriceString(line.unitCost),
          })),
        },
        token,
      )
      onCreated(purchase)
    } catch (error) {
      setSubmitError(
        resolveSupplyPurchaseError(error, 'No fue posible registrar la compra. Intenta de nuevo.'),
      )
      setSubmitting(false)
    }
  }

  return (
    <form className="supply-purchase-form" onSubmit={submit} noValidate>
      {submitError && <Alert tone="error">{submitError}</Alert>}
      <div className="ui-field">
        <label className="ui-field__label" htmlFor="supply-purchase-supplier">
          Proveedor
        </label>
        <select
          id="supply-purchase-supplier"
          className="ui-field__control"
          value={supplierId}
          aria-invalid={showErrors && !supplierId ? true : undefined}
          onChange={(event) => setSupplierId(event.target.value)}
        >
          <option value="">Elige el proveedor</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        {showErrors && !supplierId && (
          <span className="ui-field__error" role="alert">
            Elige el proveedor.
          </span>
        )}
      </div>

      <fieldset className="supply-purchase-form__lines">
        <legend className="ui-field__label">Insumos</legend>
        {lines.map((line, index) => {
          const error = showErrors ? lineErrors[index] : null
          const quantity = parseQuantity(line.quantity)
          return (
            <div key={line.key} className="supply-purchase-form__line">
              <select
                className="ui-field__control"
                aria-label={`Insumo de la línea ${index + 1}`}
                value={line.supplyId}
                onChange={(event) => update(line.key, 'supplyId', event.target.value)}
              >
                <option value="">Elige el insumo</option>
                {supplies.map((supply) => (
                  <option key={supply.id} value={supply.id}>
                    {supply.name} ({supply.unitOfMeasure.abbreviation})
                  </option>
                ))}
              </select>
              <input
                className="ui-field__control"
                inputMode="decimal"
                aria-label={`Cantidad de la línea ${index + 1}`}
                placeholder={
                  unitOf(line.supplyId) ? `Cantidad en ${unitOf(line.supplyId)}` : 'Cantidad'
                }
                value={line.quantity}
                onChange={(event) => update(line.key, 'quantity', event.target.value)}
              />
              <input
                className="ui-field__control"
                inputMode="decimal"
                aria-label={`Costo unitario de la línea ${index + 1}`}
                placeholder="Costo por unidad"
                value={line.unitCost}
                onChange={(event) => update(line.key, 'unitCost', event.target.value)}
              />
              <span className="supply-purchase-form__subtotal">
                {quantity !== null && isValidPrice(line.unitCost)
                  ? formatPrice(lineSubtotalCents(quantity, toPriceString(line.unitCost)) / 100)
                  : '—'}
              </span>
              <button
                type="button"
                className="supply-purchase-form__remove"
                aria-label={`Quitar la línea ${index + 1}`}
                disabled={lines.length === 1}
                onClick={() =>
                  setLines((previous) => previous.filter((item) => item.key !== line.key))
                }
              >
                ×
              </button>
              {error && (
                <span className="ui-field__error supply-purchase-form__error" role="alert">
                  {error}
                </span>
              )}
            </div>
          )
        })}
        <button
          type="button"
          className="supply-purchase-form__add"
          onClick={() => setLines((previous) => [...previous, emptyLine()])}
        >
          Agregar insumo
        </button>
      </fieldset>

      <div className="ui-field">
        <label className="ui-field__label" htmlFor="supply-purchase-observation">
          Observación (opcional)
        </label>
        <textarea
          id="supply-purchase-observation"
          className="ui-field__control supply-purchase-form__textarea"
          rows={2}
          maxLength={500}
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
        />
      </div>

      <div className="supply-purchase-form__footer">
        <span>
          Total de la compra <strong>{formatPrice(totalCents / 100)}</strong>
        </span>
        <div className="supply-purchase-form__actions">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Registrar compra'}
          </Button>
        </div>
      </div>
    </form>
  )
}

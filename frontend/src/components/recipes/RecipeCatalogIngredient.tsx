import { useRef, useState } from 'react'

import { useAuth } from '../../hooks/useAuth'
import { suppliesService } from '../../services/supplies.service'
import type { Supply, SupplySourceProduct } from '../../types/supply'
import type { UnitOfMeasure } from '../../types/unit'
import {
  guessSupplyUnit,
  parseUnitQuantity,
  resolveSupplyError,
  suggestProductYield,
} from '../../utils/supplies'
import { SupplyProductPicker } from '../supplies/SupplyProductPicker'
import { SupplyYieldField } from '../supplies/SupplyYieldField'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { SelectField } from '../ui/SelectField'

import '../supplies/Supplies.css'

interface RecipeCatalogIngredientProps {
  supplies: Supply[]
  units: UnitOfMeasure[]
  onUse: (supply: Supply) => void
  onCancel: () => void
}

interface FieldErrors {
  unit?: string
  yield?: string
}

export function RecipeCatalogIngredient({
  supplies,
  units,
  onUse,
  onCancel,
}: RecipeCatalogIngredientProps) {
  const { token } = useAuth()
  const [product, setProduct] = useState<SupplySourceProduct | null>(null)
  const [unitId, setUnitId] = useState('')
  const [yieldText, setYieldText] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const autoYield = useRef('')
  const abbreviationOf = (id: string) => units.find((unit) => unit.id === id)?.abbreviation

  const prefill = (productName: string, unit: string | undefined, current: string) => {
    const suggestion = suggestProductYield(productName, unit)
    if (suggestion?.kind !== 'match' || (current.trim() && current !== autoYield.current)) return
    autoYield.current = String(suggestion.quantity)
    setYieldText(autoYield.current)
  }

  const selectProduct = (next: SupplySourceProduct | null) => {
    setProduct(next)
    setErrors({})
    setSubmitError(null)
    if (!next) return
    const linked = supplies.find((supply) => supply.sourceProduct?.id === next.id)
    if (linked) {
      onUse(linked)
      return
    }
    const guessed = guessSupplyUnit(next.name)
    const guessedId = guessed ? (units.find((unit) => unit.abbreviation === guessed)?.id ?? '') : ''
    const nextUnitId = unitId || guessedId
    setUnitId(nextUnitId)
    prefill(next.name, abbreviationOf(nextUnitId), yieldText)
  }

  const createSupply = async () => {
    if (!product) return
    const quantity = parseUnitQuantity(yieldText)
    const nextErrors: FieldErrors = {
      ...(unitId ? {} : { unit: 'Elige la unidad en que se mide el insumo.' }),
      ...(quantity === null
        ? {
            yield: yieldText.trim()
              ? 'Usa un número mayor que 0 con máximo 3 decimales.'
              : 'Escribe cuánto rinde una unidad del producto.',
          }
        : {}),
    }
    setErrors(nextErrors)
    if (quantity === null || !unitId) return
    setSubmitError(null)
    setSaving(true)
    try {
      const created = await suppliesService.create(
        { unitOfMeasureId: unitId, sourceProductId: product.id, productUnitQuantity: quantity },
        token,
      )
      onUse(created)
    } catch (error) {
      setSubmitError(
        resolveSupplyError(error, 'No fue posible usar el producto como insumo. Intenta de nuevo.'),
      )
      setSaving(false)
    }
  }

  return (
    <section className="recipe-catalog" aria-labelledby="recipe-catalog-title">
      <h3 id="recipe-catalog-title" className="recipe-catalog__title">
        Usar un producto del catálogo
      </h3>
      <p className="recipe-form__hint">
        Si el producto ya es un insumo, se usa ese. Si no, el insumo se crea con el nombre del
        producto y queda en Inventario › Insumos.
      </p>
      {submitError && <Alert tone="error">{submitError}</Alert>}
      <SupplyProductPicker
        id="recipe-catalog-product"
        selected={product}
        onSelect={selectProduct}
        disabled={saving}
      />
      {product && (
        <div className="recipe-catalog__new">
          <SelectField
            id="recipe-catalog-unit"
            label="Unidad del insumo"
            placeholder="Elige la unidad"
            options={units.map((unit) => ({
              value: unit.id,
              label: `${unit.name} (${unit.abbreviation})`,
            }))}
            value={unitId}
            disabled={saving}
            error={errors.unit}
            onChange={(event) => {
              setUnitId(event.target.value)
              setErrors((current) => ({ ...current, unit: undefined }))
              prefill(product.name, abbreviationOf(event.target.value), yieldText)
            }}
          />
          <SupplyYieldField
            id="recipe-catalog-yield"
            unit={abbreviationOf(unitId)}
            productName={product.name}
            value={yieldText}
            disabled={saving}
            error={errors.yield}
            onValueChange={(value) => {
              setYieldText(value)
              setErrors((current) => ({ ...current, yield: undefined }))
            }}
          />
        </div>
      )}
      <div className="recipe-catalog__actions">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        {product && (
          <Button onClick={createSupply} disabled={saving}>
            {saving ? 'Creando insumo...' : 'Usar como ingrediente'}
          </Button>
        )}
      </div>
    </section>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { useAuth } from '../../hooks/useAuth'
import { suppliesService } from '../../services/supplies.service'
import type { Supply, SupplySourceProduct, SupplyStockRow } from '../../types/supply'
import {
  parseUnitQuantity,
  resolveSupplyError,
  suggestProductYield,
  supplyLinkSchema,
  type SupplyLinkValues,
} from '../../utils/supplies'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

import { SupplyProductPicker } from './SupplyProductPicker'
import { SupplyYieldField } from './SupplyYieldField'

import '../categories/CategoryForm.css'
import './Supplies.css'

interface SupplyLinkFormProps {
  row: SupplyStockRow
  onSaved: (supply: Supply) => void
  onCancel: () => void
}

export function SupplyLinkForm({ row, onSaved, onCancel }: SupplyLinkFormProps) {
  const { token } = useAuth()
  const unit = row.supply.unitOfMeasure.abbreviation
  const initial = row.sourceProduct ?? null
  const [product, setProduct] = useState<SupplySourceProduct | null>(
    initial ? { id: initial.id, name: initial.name } : null,
  )
  const [productError, setProductError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const autoYield = useRef('')
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SupplyLinkValues>({
    resolver: zodResolver(supplyLinkSchema),
    defaultValues: {
      productUnitQuantity: initial ? String(initial.unitQuantity) : '',
    },
  })
  const yieldText = useWatch({ control, name: 'productUnitQuantity' })
  const busy = isSubmitting || isRemoving
  const renamed = product && product.name !== row.supply.name ? product.name : null

  const selectProduct = (next: SupplySourceProduct | null) => {
    setProduct(next)
    setProductError(null)
    setSubmitError(null)
    if (!next || next.id === initial?.id) return
    const suggestion = suggestProductYield(next.name, unit)
    const current = getValues('productUnitQuantity').trim()
    const untouched =
      !current || current === autoYield.current || current === String(initial?.unitQuantity ?? '')
    if (suggestion?.kind !== 'match' || !untouched) return
    autoYield.current = String(suggestion.quantity)
    setValue('productUnitQuantity', autoYield.current, { shouldValidate: Boolean(current) })
  }

  const onSubmit = async (values: SupplyLinkValues) => {
    if (!product) {
      setProductError('Elige el producto del catálogo.')
      return
    }
    setSubmitError(null)
    try {
      onSaved(
        await suppliesService.updateLink(
          row.supplyId,
          {
            sourceProductId: product.id,
            productUnitQuantity: parseUnitQuantity(values.productUnitQuantity) ?? undefined,
          },
          token,
        ),
      )
    } catch (error) {
      setSubmitError(
        resolveSupplyError(error, 'No fue posible guardar el vínculo. Intenta de nuevo.'),
      )
    }
  }

  const removeLink = async () => {
    setSubmitError(null)
    setIsRemoving(true)
    try {
      onSaved(await suppliesService.updateLink(row.supplyId, { sourceProductId: null }, token))
    } catch (error) {
      setSubmitError(
        resolveSupplyError(error, 'No fue posible quitar el vínculo. Intenta de nuevo.'),
      )
      setIsRemoving(false)
    }
  }

  return (
    <form
      className="category-form"
      onSubmit={handleSubmit(onSubmit, () => {
        if (!product) setProductError('Elige el producto del catálogo.')
      })}
      noValidate
    >
      {submitError && <Alert tone="error">{submitError}</Alert>}
      <p className="category-form__note">
        Al ligar el insumo, cada unidad del producto que se abra en una sede suma la cantidad que
        indiques, y el insumo toma el nombre del producto. Cada producto alimenta un solo insumo.
      </p>
      <SupplyProductPicker
        id="supply-link-product"
        selected={product}
        onSelect={selectProduct}
        disabled={busy}
        error={productError ?? undefined}
      />
      {renamed && (
        <div className="supply-form__derived-name">
          <span>El insumo pasará a llamarse</span>
          <strong>{renamed}</strong>
          <small>Desde ahora sigue el nombre del producto en el catálogo.</small>
        </div>
      )}
      <SupplyYieldField
        id="supply-link-quantity"
        unit={unit}
        productName={product?.name}
        value={yieldText}
        disabled={busy}
        error={errors.productUnitQuantity?.message}
        registration={register('productUnitQuantity')}
      />
      <div className="category-form__actions supply-link__actions">
        {initial && (
          <Button variant="outline" onClick={removeLink} disabled={busy}>
            {isRemoving ? 'Quitando...' : 'Quitar vínculo'}
          </Button>
        )}
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {isSubmitting ? 'Guardando...' : 'Guardar vínculo'}
        </Button>
      </div>
    </form>
  )
}

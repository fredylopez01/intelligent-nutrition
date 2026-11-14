import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { useAuth } from '../../hooks/useAuth'
import { suppliesService } from '../../services/supplies.service'
import type { Supply, SupplySourceProduct, SupplyStockRow } from '../../types/supply'
import {
  parseUnitQuantity,
  resolveSupplyError,
  supplyLinkSchema,
  type SupplyLinkValues,
} from '../../utils/supplies'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'

import { SupplyProductPicker } from './SupplyProductPicker'

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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SupplyLinkValues>({
    resolver: zodResolver(supplyLinkSchema),
    defaultValues: {
      productUnitQuantity: initial ? String(initial.unitQuantity) : '',
    },
  })
  const busy = isSubmitting || isRemoving

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
        indiques. El vínculo aplica en todas las sedes.
      </p>
      <SupplyProductPicker
        id="supply-link-product"
        selected={product}
        onSelect={(next) => {
          setProduct(next)
          setProductError(null)
        }}
        disabled={busy}
        error={productError ?? undefined}
      />
      <TextField
        id="supply-link-quantity"
        label={`Cuánto rinde una unidad del producto (${unit})`}
        inputMode="decimal"
        autoComplete="off"
        placeholder="Ej. 30"
        hint="Ej. un tarro de proteína de 900 g rinde 900 si el insumo se mide en gramos."
        error={errors.productUnitQuantity?.message}
        {...register('productUnitQuantity')}
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

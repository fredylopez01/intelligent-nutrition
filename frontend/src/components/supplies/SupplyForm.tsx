import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { useAuth } from '../../hooks/useAuth'
import { suppliesService } from '../../services/supplies.service'
import { unitsService } from '../../services/units.service'
import type { Supply, SupplySourceProduct } from '../../types/supply'
import type { UnitOfMeasure } from '../../types/unit'
import {
  parseUnitQuantity,
  resolveSupplyError,
  suggestProductYield,
  supplySchema,
  type SupplyFormValues,
} from '../../utils/supplies'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { SelectField } from '../ui/SelectField'
import { TextField } from '../ui/TextField'

import { SupplyProductPicker } from './SupplyProductPicker'
import { SupplyYieldField } from './SupplyYieldField'

import '../categories/CategoryForm.css'
import './Supplies.css'

interface SupplyFormProps {
  onSaved: (supply: Supply) => void
  onCancel: () => void
}

interface UnitsResult {
  key: number
  units: UnitOfMeasure[]
  error: boolean
}

export function SupplyForm({ onSaved, onCancel }: SupplyFormProps) {
  const { token } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [units, setUnits] = useState<UnitsResult | null>(null)
  const [product, setProduct] = useState<SupplySourceProduct | null>(null)
  const [productError, setProductError] = useState<string | null>(null)
  const autoYield = useRef('')
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SupplyFormValues>({
    resolver: zodResolver(supplySchema),
    defaultValues: { name: '', unitOfMeasureId: '', linked: false, productUnitQuantity: '' },
  })
  const linked = useWatch({ control, name: 'linked' })
  const unitId = useWatch({ control, name: 'unitOfMeasureId' })
  const yieldText = useWatch({ control, name: 'productUnitQuantity' })

  useEffect(() => {
    let cancelled = false
    unitsService
      .list({ page: 1, limit: 100, active: true }, token)
      .then((response) => {
        if (!cancelled) setUnits({ key: reloadToken, units: response.data, error: false })
      })
      .catch(() => {
        if (!cancelled) setUnits({ key: reloadToken, units: [], error: true })
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken, token])
  const currentUnits = units?.key === reloadToken ? units : null
  const unitAbbreviation = currentUnits?.units.find((unit) => unit.id === unitId)?.abbreviation
  const abbreviationOf = (id: string) =>
    currentUnits?.units.find((unit) => unit.id === id)?.abbreviation

  const prefillYield = (productName: string | undefined, unit: string | undefined) => {
    if (!productName) return
    const suggestion = suggestProductYield(productName, unit)
    const current = getValues('productUnitQuantity').trim()
    if (suggestion?.kind !== 'match' || (current && current !== autoYield.current)) return
    const text = String(suggestion.quantity)
    autoYield.current = text
    setValue('productUnitQuantity', text, { shouldValidate: Boolean(current) })
  }
  const unitField = register('unitOfMeasureId')

  const onSubmit = async (values: SupplyFormValues) => {
    if (values.linked && !product) {
      setProductError('Elige el producto del catálogo.')
      return
    }
    setSubmitError(null)
    const quantity = parseUnitQuantity(values.productUnitQuantity)
    try {
      onSaved(
        await suppliesService.create(
          {
            unitOfMeasureId: values.unitOfMeasureId,
            ...(values.linked && product && quantity !== null
              ? { sourceProductId: product.id, productUnitQuantity: quantity }
              : { name: values.name.trim() }),
          },
          token,
        ),
      )
    } catch (error) {
      const message = resolveSupplyError(
        error,
        'No fue posible registrar el insumo. Intenta de nuevo.',
      )
      if (message === 'Ya existe un insumo con ese nombre.' && !values.linked) {
        setError('name', { message })
        return
      }
      setSubmitError(message)
    }
  }

  return (
    <form
      className="category-form"
      onSubmit={handleSubmit(onSubmit, (invalid) => {
        if (linked && !product && !invalid.linked)
          setProductError('Elige el producto del catálogo.')
      })}
      noValidate
    >
      {submitError && <Alert tone="error">{submitError}</Alert>}
      <label className="supply-form__link-toggle" htmlFor="supply-linked">
        <input id="supply-linked" type="checkbox" disabled={isSubmitting} {...register('linked')} />
        <strong>Viene de un producto del catálogo</strong>
        <small>
          Úsalo cuando una receta necesita parte de un producto que se vende, como una porción de
          proteína. El insumo toma el nombre del producto.
        </small>
      </label>
      {linked ? (
        <div className="supply-form__link">
          <SupplyProductPicker
            id="supply-product-search"
            selected={product}
            onSelect={(next) => {
              setProduct(next)
              setProductError(null)
              setSubmitError(null)
              prefillYield(next?.name, unitAbbreviation)
            }}
            disabled={isSubmitting}
            error={productError ?? undefined}
          />
          {product && (
            <div className="supply-form__derived-name">
              <span>Nombre del insumo</span>
              <strong>{product.name}</strong>
              <small>Se toma del producto y cambia si lo renombran en el catálogo.</small>
            </div>
          )}
        </div>
      ) : (
        <TextField
          id="supply-name"
          label="Nombre"
          placeholder="Ej. Leche entera"
          autoComplete="off"
          error={errors.name?.message}
          {...register('name')}
        />
      )}
      {currentUnits?.error ? (
        <div className="supply-form__units-error">
          <Alert tone="error">No fue posible cargar las unidades de medida.</Alert>
          <Button variant="outline" onClick={() => setReloadToken((value) => value + 1)}>
            Reintentar
          </Button>
        </div>
      ) : (
        <SelectField
          id="supply-unit"
          label="Unidad de medida"
          placeholder={currentUnits ? 'Elige la unidad' : 'Cargando unidades...'}
          options={(currentUnits?.units ?? []).map((unit) => ({
            value: unit.id,
            label: `${unit.name} (${unit.abbreviation})`,
          }))}
          disabled={!currentUnits || isSubmitting}
          hint="El stock y los movimientos se cuentan en esta unidad."
          error={errors.unitOfMeasureId?.message}
          {...unitField}
          onChange={(event) => {
            void unitField.onChange(event)
            if (linked) prefillYield(product?.name, abbreviationOf(event.target.value))
          }}
        />
      )}
      {linked && (
        <SupplyYieldField
          id="supply-product-quantity"
          unit={unitAbbreviation}
          productName={product?.name}
          value={yieldText}
          disabled={isSubmitting}
          error={errors.productUnitQuantity?.message}
          registration={register('productUnitQuantity')}
        />
      )}
      <p className="category-form__note">
        El insumo queda disponible en todas las sedes con stock 0. Registra una entrada para sumar
        existencias.
      </p>
      <div className="category-form__actions">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando...' : 'Registrar insumo'}
        </Button>
      </div>
    </form>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { useAuth } from '../../hooks/useAuth'
import { ApiError } from '../../services/http'
import { inventoryService } from '../../services/inventory.service'
import { suppliesService } from '../../services/supplies.service'
import type { ProductConversion, SupplyStockRow } from '../../types/supply'
import {
  CONVERSION_MAX_UNITS,
  SUPPLY_OBSERVATION_MAX_LENGTH,
  conversionSchema,
  formatSupplyQuantity,
  productUnitsLabel,
  resolveSupplyError,
  supplyQuantity,
  type ConversionValues,
} from '../../utils/supplies'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { TextAreaField } from '../ui/TextAreaField'
import { TextField } from '../ui/TextField'

import '../categories/CategoryForm.css'
import './Supplies.css'

interface SupplyConversionFormProps {
  row: SupplyStockRow
  onSaved: (conversion: ProductConversion) => void
  onCancel: () => void
}

interface Availability {
  key: string
  units: number | null
}

function todayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function availableDetail(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.code !== 'INSUFFICIENT_STOCK') return null
  const details = error.details as { available?: unknown } | undefined
  return typeof details?.available === 'number' ? details.available : null
}

export function SupplyConversionForm({ row, onSaved, onCancel }: SupplyConversionFormProps) {
  const { token } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const source = row.sourceProduct
  const unit = row.supply.unitOfMeasure.abbreviation
  const availabilityKey = `${row.branchId}|${source?.id ?? ''}`
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ConversionValues>({
    resolver: zodResolver(conversionSchema),
    defaultValues: { productUnits: '1', observation: '' },
  })
  const unitsText = useWatch({ control, name: 'productUnits' })
  const observation = useWatch({ control, name: 'observation' })

  useEffect(() => {
    if (!source) return
    let cancelled = false
    inventoryService
      .getProductInBranch(row.branchId, source.id, token)
      .then((detail) => {
        if (cancelled) return
        const today = todayKey()
        const units = detail.lots
          .filter((lot) => lot.expirationDate.slice(0, 10) >= today)
          .reduce((total, lot) => total + lot.quantity, 0)
        setAvailability({ key: availabilityKey, units })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const missing = error instanceof ApiError && error.code === 'PRODUCT_NOT_ASSIGNED'
        setAvailability({ key: availabilityKey, units: missing ? 0 : null })
      })
    return () => {
      cancelled = true
    }
  }, [availabilityKey, row.branchId, source, token])

  if (!source) {
    return (
      <div className="category-form">
        <Alert tone="info">
          Este insumo no está ligado a un producto del catálogo. Lígalo primero desde sus acciones.
        </Alert>
        <div className="category-form__actions">
          <Button variant="outline" onClick={onCancel}>
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  const current = availability?.key === availabilityKey ? availability : null
  const units = /^\d{1,9}$/.test(unitsText.trim()) ? Number(unitsText.trim()) : 0
  const added = units * source.unitQuantity
  const resulting = supplyQuantity(row.quantity) + added
  const exceeds = current?.units !== null && current?.units !== undefined && units > current.units

  const onSubmit = async (values: ConversionValues) => {
    setSubmitError(null)
    try {
      onSaved(
        await suppliesService.convert(
          {
            branchId: row.branchId,
            supplyId: row.supplyId,
            productUnits: Number(values.productUnits),
            ...(values.observation ? { observation: values.observation } : {}),
          },
          token,
        ),
      )
    } catch (error) {
      const available = availableDetail(error)
      if (available !== null) {
        setError(
          'productUnits',
          {
            message:
              available === 0
                ? `${row.branchName ?? 'La sede'} no tiene unidades vigentes de ${source.name}.`
                : `La sede solo tiene ${productUnitsLabel(available)} de ${source.name} sin vencer.`,
          },
          { shouldFocus: true },
        )
        return
      }
      setSubmitError(
        resolveSupplyError(error, 'No fue posible convertir el producto. Intenta de nuevo.'),
      )
    }
  }

  return (
    <form className="category-form supply-movement" onSubmit={handleSubmit(onSubmit)} noValidate>
      {submitError && <Alert tone="error">{submitError}</Alert>}

      <dl className="supply-conversion__facts">
        <div>
          <dt>Producto de origen</dt>
          <dd>{source.name}</dd>
        </div>
        <div>
          <dt>Rinde por unidad</dt>
          <dd className="supply-conversion__number">
            {formatSupplyQuantity(source.unitQuantity, unit)}
          </dd>
        </div>
        <div>
          <dt>Unidades vigentes en {row.branchName ?? 'la sede'}</dt>
          <dd className="supply-conversion__number">
            {current === null ? 'Consultando...' : (current.units ?? 'Sin dato')}
          </dd>
        </div>
      </dl>

      {current?.units === 0 && (
        <Alert tone="info">
          {row.branchName ?? 'La sede'} no tiene unidades vigentes de {source.name}. Asígnalas desde
          el inventario antes de convertir.
        </Alert>
      )}

      <TextField
        id="supply-conversion-units"
        label="Unidades del producto que vas a abrir"
        inputMode="numeric"
        autoComplete="off"
        hint={`Entre 1 y ${CONVERSION_MAX_UNITS}. Se descuentan primero los lotes que vencen antes.`}
        error={errors.productUnits?.message}
        {...register('productUnits')}
      />
      <TextAreaField
        id="supply-conversion-observation"
        label="Nota (opcional)"
        rows={2}
        maxLength={SUPPLY_OBSERVATION_MAX_LENGTH}
        length={observation.length}
        placeholder="Ej. Para la barra de batidos de la mañana"
        error={errors.observation?.message}
        {...register('observation')}
      />

      {units > 0 && (
        <p className="supply-movement__result" role="status">
          {exceeds ? (
            <>No hay tantas unidades vigentes en la sede.</>
          ) : (
            <>
              {units === 1 ? 'Se descuenta' : 'Se descuentan'}{' '}
              <strong>{productUnitsLabel(units)}</strong> de {source.name} del inventario y se suman{' '}
              <strong>{formatSupplyQuantity(added, unit)}</strong> de {row.supply.name}. Quedarán{' '}
              <strong>{formatSupplyQuantity(resulting, unit)}</strong>.
            </>
          )}
        </p>
      )}

      <div className="category-form__actions">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || current?.units === 0}>
          {isSubmitting ? 'Convirtiendo...' : 'Convertir a insumo'}
        </Button>
      </div>
    </form>
  )
}

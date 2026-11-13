import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { useAuth } from '../../hooks/useAuth'
import { suppliesService } from '../../services/supplies.service'
import type { SupplyStockRow } from '../../types/supply'
import {
  formatSupplyQuantity,
  parseMinimum,
  resolveSupplyError,
  supplyMinimumSchema,
  supplyQuantity,
  type SupplyMinimumValues,
} from '../../utils/supplies'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'

import '../categories/CategoryForm.css'
import './Supplies.css'

interface SupplyMinimumFormProps {
  row: SupplyStockRow
  onSaved: (row: SupplyStockRow) => void
  onCancel: () => void
}

export function SupplyMinimumForm({ row, onSaved, onCancel }: SupplyMinimumFormProps) {
  const { token } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const unit = row.supply.unitOfMeasure.abbreviation
  const current = supplyQuantity(row.minimumQuantity)
  const available = supplyQuantity(row.quantity)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SupplyMinimumValues>({
    resolver: zodResolver(supplyMinimumSchema),
    defaultValues: { minimumQuantity: String(current).replace('.', ',') },
  })
  const draft = parseMinimum(useWatch({ control, name: 'minimumQuantity' }))
  const willBeLow = draft !== null && available < draft

  const onSubmit = async (values: SupplyMinimumValues) => {
    setSubmitError(null)
    const minimumQuantity = parseMinimum(values.minimumQuantity) ?? 0
    if (minimumQuantity === current) {
      setSubmitError('El stock mínimo no cambió.')
      return
    }
    try {
      onSaved(
        await suppliesService.setMinimum(
          { branchId: row.branchId, supplyId: row.supplyId, minimumQuantity },
          token,
        ),
      )
    } catch (error) {
      setSubmitError(
        resolveSupplyError(error, 'No fue posible guardar el stock mínimo. Intenta de nuevo.'),
      )
    }
  }

  return (
    <form className="category-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {submitError && <Alert tone="error">{submitError}</Alert>}
      <TextField
        id="supply-minimum"
        label={`Stock mínimo (${unit})`}
        inputMode="decimal"
        autoComplete="off"
        hint={`Hoy hay ${formatSupplyQuantity(available, unit)} en ${row.branchName ?? 'la sede'}.`}
        error={errors.minimumQuantity?.message}
        {...register('minimumQuantity')}
      />
      {willBeLow && (
        <p className="supply-movement__warning" role="status">
          Con este mínimo el insumo quedará marcado con stock bajo.
        </p>
      )}
      <div className="category-form__actions">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar mínimo'}
        </Button>
      </div>
    </form>
  )
}

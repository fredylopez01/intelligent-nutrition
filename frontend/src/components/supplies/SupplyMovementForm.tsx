import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { useAuth } from '../../hooks/useAuth'
import { suppliesService } from '../../services/supplies.service'
import type { SupplyMovement, SupplyStockRow } from '../../types/supply'
import {
  SUPPLY_OBSERVATION_MAX_LENGTH,
  buildMovementSchema,
  formatSupplyQuantity,
  resolveSupplyError,
  supplyQuantity,
  type SupplyMovementValues,
} from '../../utils/supplies'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { TextAreaField } from '../ui/TextAreaField'
import { TextField } from '../ui/TextField'

import '../categories/CategoryForm.css'
import './Supplies.css'

interface SupplyMovementFormProps {
  row: SupplyStockRow
  onSaved: (movement: SupplyMovement) => void
  onCancel: () => void
}

const TYPE_OPTIONS = [
  { value: 'ENTRY', label: 'Entrada', description: 'Suma al stock' },
  { value: 'EXIT', label: 'Salida', description: 'Resta del stock' },
] as const

export function SupplyMovementForm({ row, onSaved, onCancel }: SupplyMovementFormProps) {
  const { token } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const unit = row.supply.unitOfMeasure.abbreviation
  const available = supplyQuantity(row.quantity)
  const schema = useMemo(() => buildMovementSchema(available, unit), [available, unit])
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SupplyMovementValues>({
    resolver: zodResolver(schema),
    defaultValues: { movementType: 'ENTRY', quantity: '', observation: '' },
  })
  const movementType = useWatch({ control, name: 'movementType' })
  const quantityText = useWatch({ control, name: 'quantity' })
  const observation = useWatch({ control, name: 'observation' })
  const quantity = /^\d{1,9}$/.test(quantityText.trim()) ? Number(quantityText.trim()) : 0
  const resulting = movementType === 'ENTRY' ? available + quantity : available - quantity
  const isExit = movementType === 'EXIT'

  const onSubmit = async (values: SupplyMovementValues) => {
    setSubmitError(null)
    try {
      const movement = await suppliesService.move(
        {
          branchId: row.branchId,
          supplyId: row.supplyId,
          movementType: values.movementType,
          quantity: Number(values.quantity),
          ...(values.observation ? { observation: values.observation } : {}),
        },
        token,
      )
      onSaved(movement)
    } catch (error) {
      setSubmitError(
        resolveSupplyError(error, 'No fue posible registrar el movimiento. Intenta de nuevo.'),
      )
    }
  }

  return (
    <form className="category-form supply-movement" onSubmit={handleSubmit(onSubmit)} noValidate>
      {submitError && <Alert tone="error">{submitError}</Alert>}

      <p className="supply-movement__current">
        Stock actual en {row.branchName ?? 'la sede'}:{' '}
        <strong>{formatSupplyQuantity(available, unit)}</strong>
      </p>

      <fieldset className="supply-movement__types">
        <legend className="supply-movement__legend">Tipo de movimiento</legend>
        {TYPE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`supply-movement__type${movementType === option.value ? ' supply-movement__type--on' : ''}`}
          >
            <input type="radio" value={option.value} {...register('movementType')} />
            <span className="supply-movement__type-label">{option.label}</span>
            <span className="supply-movement__type-hint">{option.description}</span>
          </label>
        ))}
      </fieldset>

      <TextField
        id="supply-movement-quantity"
        label={`Cantidad (${unit})`}
        inputMode="numeric"
        autoComplete="off"
        placeholder="Ej. 500"
        error={errors.quantity?.message}
        {...register('quantity')}
      />
      <TextAreaField
        id="supply-movement-observation"
        label={isExit ? 'Motivo' : 'Motivo (opcional)'}
        rows={2}
        maxLength={SUPPLY_OBSERVATION_MAX_LENGTH}
        length={observation.length}
        placeholder={isExit ? 'Ej. Preparación de batidos' : 'Ej. Compra en supermercado'}
        error={errors.observation?.message}
        {...register('observation')}
      />

      {quantity > 0 && resulting >= 0 && (
        <p className="supply-movement__result" role="status">
          Después del movimiento quedarán <strong>{formatSupplyQuantity(resulting, unit)}</strong>.
        </p>
      )}

      <div className="category-form__actions">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando...' : isExit ? 'Registrar salida' : 'Registrar entrada'}
        </Button>
      </div>
    </form>
  )
}

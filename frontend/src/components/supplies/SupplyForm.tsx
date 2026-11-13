import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import { useAuth } from '../../hooks/useAuth'
import { suppliesService } from '../../services/supplies.service'
import { unitsService } from '../../services/units.service'
import type { Supply } from '../../types/supply'
import type { UnitOfMeasure } from '../../types/unit'
import { resolveSupplyError, supplySchema, type SupplyFormValues } from '../../utils/supplies'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { SelectField } from '../ui/SelectField'
import { TextField } from '../ui/TextField'

import '../categories/CategoryForm.css'

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
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupplyFormValues>({
    resolver: zodResolver(supplySchema),
    defaultValues: { name: '', unitOfMeasureId: '' },
  })

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

  const onSubmit = async (values: SupplyFormValues) => {
    setSubmitError(null)
    try {
      onSaved(
        await suppliesService.create(
          { name: values.name.trim(), unitOfMeasureId: values.unitOfMeasureId },
          token,
        ),
      )
    } catch (error) {
      const message = resolveSupplyError(
        error,
        'No fue posible registrar el insumo. Intenta de nuevo.',
      )
      if (message === 'Ya existe un insumo con ese nombre.') {
        setError('name', { message })
        return
      }
      setSubmitError(message)
    }
  }

  return (
    <form className="category-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {submitError && <Alert tone="error">{submitError}</Alert>}
      <TextField
        id="supply-name"
        label="Nombre"
        placeholder="Ej. Leche entera"
        autoComplete="off"
        error={errors.name?.message}
        {...register('name')}
      />
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
          {...register('unitOfMeasureId')}
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

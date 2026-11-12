import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { useAuth } from '../../hooks/useAuth'
import { promotionsService } from '../../services/promotions.service'
import type { Promotion, UpdatePromotionPayload } from '../../types/promotion'
import {
  promotionFieldError,
  promotionSchema,
  resolvePromotionError,
  toPercentageString,
  type PromotionFormValues,
} from '../../utils/promotions'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'

import '../categories/CategoryForm.css'
import './Promotions.css'

interface PromotionFormProps {
  promotion?: Promotion
  onSaved: (promotion: Promotion) => void
  onCancel: () => void
}

function initialValues(promotion?: Promotion): PromotionFormValues {
  return {
    name: promotion?.name ?? '',
    discountPercentage: promotion ? String(Number(promotion.discountPercentage)) : '',
    startDate: promotion?.startDate ?? '',
    endDate: promotion?.endDate ?? '',
  }
}

export function PromotionForm({ promotion, onSaved, onCancel }: PromotionFormProps) {
  const { token } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isEdit = promotion !== undefined
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: initialValues(promotion),
  })

  const onSubmit = async (values: PromotionFormValues) => {
    setSubmitError(null)
    const payload = {
      name: values.name,
      discountPercentage: toPercentageString(values.discountPercentage),
      ...(values.startDate ? { startDate: values.startDate } : {}),
      ...(values.endDate ? { endDate: values.endDate } : {}),
    }
    try {
      if (promotion) {
        const original = initialValues(promotion)
        const changes: UpdatePromotionPayload = {}
        if (values.name !== original.name) changes.name = payload.name
        if (payload.discountPercentage !== promotion.discountPercentage) {
          changes.discountPercentage = payload.discountPercentage
        }
        if (values.startDate && values.startDate !== original.startDate) {
          changes.startDate = values.startDate
        }
        if (values.endDate && values.endDate !== original.endDate) {
          changes.endDate = values.endDate
        }
        if (Object.keys(changes).length === 0) {
          setSubmitError('No hay cambios por guardar.')
          return
        }
        onSaved(await promotionsService.update(promotion.id, changes, token))
      } else {
        onSaved(await promotionsService.create(payload, token))
      }
    } catch (error) {
      const fieldError = promotionFieldError(error)
      if (fieldError) {
        setError(fieldError.field, { message: fieldError.message }, { shouldFocus: true })
        return
      }
      setSubmitError(
        resolvePromotionError(
          error,
          isEdit
            ? 'No fue posible guardar la promoción. Intenta de nuevo.'
            : 'No fue posible registrar la promoción. Intenta de nuevo.',
        ),
      )
    }
  }

  return (
    <form className="category-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {submitError && <Alert tone="error">{submitError}</Alert>}

      <TextField
        id="promotion-name"
        label="Nombre"
        placeholder="Ej. Descuento de temporada"
        autoComplete="off"
        error={errors.name?.message}
        {...register('name')}
      />
      <div className="promotion-form__percentage">
        <TextField
          id="promotion-discount"
          label="Descuento (%)"
          placeholder="Ej. 15"
          inputMode="decimal"
          autoComplete="off"
          hint="Se aplica sobre el total de cada venta mientras la promoción esté activa."
          error={errors.discountPercentage?.message}
          {...register('discountPercentage')}
        />
      </div>
      <div className="promotion-form__dates">
        <TextField
          id="promotion-start"
          label="Desde (opcional)"
          type="date"
          error={errors.startDate?.message}
          {...register('startDate')}
        />
        <TextField
          id="promotion-end"
          label="Hasta (opcional)"
          type="date"
          error={errors.endDate?.message}
          {...register('endDate')}
        />
      </div>

      <p className="category-form__note">
        {isEdit
          ? 'Solo se pueden editar promociones inactivas. Los cambios no afectan las ventas ya registradas.'
          : 'La promoción queda inactiva al registrarla. Actívala desde el listado cuando quieras aplicarla.'}
      </p>

      <div className="category-form__actions">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Registrar promoción'}
        </Button>
      </div>
    </form>
  )
}

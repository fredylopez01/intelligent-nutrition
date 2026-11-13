import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { useAuth } from '../../hooks/useAuth'
import { profileService } from '../../services/profile.service'
import type { OwnProfile } from '../../types/profile'
import {
  buildProfilePayload,
  buildProfileSchema,
  profileFormValues,
  profileFullName,
  resolveProfileError,
  type ProfileFormValues,
} from '../../utils/profile'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'

interface ProfileFormProps {
  profile: OwnProfile
  onSaved: (profile: OwnProfile) => void
}

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

export function ProfileForm({ profile, onSaved }: ProfileFormProps) {
  const { token, updateSessionUser } = useAuth()
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const initial = useMemo(() => profileFormValues(profile), [profile])
  const schema = useMemo(() => buildProfileSchema(initial), [initial])
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  })

  const onSubmit = async (values: ProfileFormValues) => {
    setFeedback(null)
    const payload = buildProfilePayload(values, initial)
    if (Object.keys(payload).length === 0) {
      setFeedback({ tone: 'error', message: 'No hay cambios por guardar.' })
      return
    }
    try {
      const updated = await profileService.update(payload, token)
      updateSessionUser({ fullName: profileFullName(updated) })
      reset(profileFormValues(updated))
      onSaved(updated)
      setFeedback({ tone: 'success', message: 'Tus datos se actualizaron.' })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: resolveProfileError(error, 'No fue posible guardar tus datos. Intenta de nuevo.'),
      })
    }
  }

  const documentLabel = profile.person.documentNumber
    ? `${profile.person.documentType?.code ?? 'Documento'} ${profile.person.documentNumber}`
    : 'Sin documento registrado'

  return (
    <section className="profile-card" aria-labelledby="profile-data-title">
      <h2 id="profile-data-title" className="profile-card__title">
        Datos personales
      </h2>

      {feedback && (
        <div className="profile-card__feedback">
          <Alert tone={feedback.tone}>{feedback.message}</Alert>
        </div>
      )}

      <form
        className="profile-form"
        onSubmit={handleSubmit(onSubmit, () => setFeedback(null))}
        noValidate
      >
        <div className="profile-form__grid">
          <TextField
            id="profile-first-name"
            label="Nombres"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <TextField
            id="profile-last-name"
            label="Apellidos"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
          <TextField
            id="profile-email"
            label="Correo"
            type="email"
            value={profile.email}
            readOnly
            hint="Tu correo es tu usuario de ingreso. Para cambiarlo, pídeselo al superadmin."
          />
          <TextField id="profile-document" label="Documento" value={documentLabel} readOnly />
          <TextField
            id="profile-phone"
            label="Teléfono"
            inputMode="numeric"
            autoComplete="tel"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <TextField
            id="profile-address"
            label="Dirección"
            autoComplete="street-address"
            error={errors.address?.message}
            {...register('address')}
          />
        </div>

        <div className="profile-form__actions">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              reset(initial)
              setFeedback(null)
            }}
            disabled={isSubmitting || !isDirty}
          >
            Descartar
          </Button>
        </div>
      </form>
    </section>
  )
}

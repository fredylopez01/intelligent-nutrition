import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { useAuth } from '../../hooks/useAuth'
import { chatService } from '../../services/chat.service'
import type { ChatKnowledgeEntry } from '../../types/chat'
import {
  KNOWLEDGE_CONTENT_MAX_LENGTH,
  knowledgeSchema,
  resolveKnowledgeError,
  type KnowledgeFormValues,
} from '../../utils/chat'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { TextAreaField } from '../ui/TextAreaField'
import { TextField } from '../ui/TextField'

import '../categories/CategoryForm.css'
import './ChatbotPage.css'

interface KnowledgeEntryFormProps {
  entry?: ChatKnowledgeEntry
  onSaved: (entry: ChatKnowledgeEntry) => void
  onCancel: () => void
}

export function KnowledgeEntryForm({ entry, onSaved, onCancel }: KnowledgeEntryFormProps) {
  const { token } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<KnowledgeFormValues>({
    resolver: zodResolver(knowledgeSchema),
    defaultValues: {
      title: entry?.title ?? '',
      content: entry?.content ?? '',
      active: entry?.active ?? true,
    },
  })
  const content = useWatch({ control, name: 'content' })

  const onSubmit = async (values: KnowledgeFormValues) => {
    setSubmitError(null)
    const payload = {
      title: values.title.trim(),
      content: values.content.trim(),
      active: values.active,
    }
    try {
      if (entry) {
        const changes = Object.fromEntries(
          Object.entries(payload).filter(
            ([key, value]) => entry[key as keyof typeof payload] !== value,
          ),
        )
        if (Object.keys(changes).length === 0) {
          setSubmitError('No hay cambios por guardar.')
          return
        }
        onSaved(await chatService.updateKnowledge(entry.id, changes, token))
        return
      }
      onSaved(await chatService.createKnowledge(payload, token))
    } catch (error) {
      setSubmitError(
        resolveKnowledgeError(error, 'No fue posible guardar la información. Intenta de nuevo.'),
      )
    }
  }

  return (
    <form className="category-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {submitError && <Alert tone="error">{submitError}</Alert>}
      <TextField
        id="knowledge-title"
        label="Tema"
        placeholder="Ej. Envíos a domicilio"
        autoComplete="off"
        error={errors.title?.message}
        {...register('title')}
      />
      <TextAreaField
        id="knowledge-content"
        label="Información para el asistente"
        rows={6}
        maxLength={KNOWLEDGE_CONTENT_MAX_LENGTH}
        length={content.length}
        placeholder="Ej. Los domicilios se hacen desde las sedes que los tienen activos. El costo depende del barrio y se confirma por WhatsApp."
        hint="Escríbela como la diría un asesor. El asistente la usa tal cual y no agrega datos."
        error={errors.content?.message}
        {...register('content')}
      />
      <label className="chatbot-form__toggle" htmlFor="knowledge-active">
        <input id="knowledge-active" type="checkbox" {...register('active')} />
        <strong>Activa</strong>
        <small>Solo las entradas activas llegan al asistente.</small>
      </label>
      <div className="category-form__actions">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : entry ? 'Guardar cambios' : 'Agregar información'}
        </Button>
      </div>
    </form>
  )
}

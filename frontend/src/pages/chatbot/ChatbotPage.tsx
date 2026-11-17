import { useEffect, useState } from 'react'

import { KnowledgeEntryForm } from '../../components/chat/KnowledgeEntryForm'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { ReloadButton } from '../../components/ui/ReloadButton'
import { RowActions } from '../../components/ui/RowActions'
import { TableSkeleton } from '../../components/ui/TableSkeleton'
import { useAuth } from '../../hooks/useAuth'
import { AppLayout } from '../../layouts/AppLayout'
import { chatService } from '../../services/chat.service'
import type { ChatKnowledgeEntry, ChatStatus } from '../../types/chat'
import { KNOWLEDGE_ACTIVE_LIMIT, formatUsd, resolveKnowledgeError } from '../../utils/chat'

import '../../components/categories/CategoryForm.css'
import '../../components/chat/ChatbotPage.css'

interface ListState {
  key: number
  status: 'success' | 'error'
  entries: ChatKnowledgeEntry[]
}

interface Limits {
  internal: ChatStatus | null
  visitors: ChatStatus | null
}

export function ChatbotPage() {
  const { token } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const [list, setList] = useState<ListState | null>(null)
  const [limits, setLimits] = useState<Limits | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ChatKnowledgeEntry | null>(null)
  const [deleting, setDeleting] = useState<ChatKnowledgeEntry | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    chatService
      .listKnowledge(token)
      .then((entries) => {
        if (!cancelled) setList({ key: reloadKey, status: 'success', entries })
      })
      .catch(() => {
        if (!cancelled) setList({ key: reloadKey, status: 'error', entries: [] })
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey, token])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      chatService.status(token).catch(() => null),
      chatService.status(null).catch(() => null),
    ]).then(([internal, visitors]) => {
      if (!cancelled) setLimits({ internal, visitors })
    })
    return () => {
      cancelled = true
    }
  }, [token])

  const current = list?.key === reloadKey ? list : null
  const entries = current?.entries ?? []
  const activeCount = entries.filter((entry) => entry.active).length
  const reload = () => setReloadKey((value) => value + 1)

  const saved = (message: string) => {
    setCreating(false)
    setEditing(null)
    setFeedback({ tone: 'success', text: message })
    reload()
  }

  const toggle = async (entry: ChatKnowledgeEntry) => {
    setFeedback(null)
    try {
      await chatService.updateKnowledge(entry.id, { active: !entry.active }, token)
      setFeedback({
        tone: 'success',
        text: entry.active
          ? `${entry.title} ya no llega al asistente.`
          : `${entry.title} vuelve a llegar al asistente.`,
      })
      reload()
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: resolveKnowledgeError(error, 'No fue posible cambiar el estado. Intenta de nuevo.'),
      })
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await chatService.removeKnowledge(deleting.id, token)
      const title = deleting.title
      setDeleting(null)
      setFeedback({ tone: 'success', text: `Se eliminó ${title}.` })
      reload()
    } catch (error) {
      setDeleteError(resolveKnowledgeError(error, 'No fue posible eliminarla. Intenta de nuevo.'))
    } finally {
      setIsDeleting(false)
    }
  }

  const renderList = () => {
    if (!current)
      return <TableSkeleton label="Cargando la base de conocimiento..." rows={4} columns={2} />
    if (current.status === 'error') {
      return (
        <div className="chatbot-page__feedback">
          <Alert tone="error">No fue posible cargar la base de conocimiento.</Alert>
          <Button variant="outline" onClick={reload}>
            Reintentar
          </Button>
        </div>
      )
    }
    if (entries.length === 0) {
      return (
        <EmptyState
          variant="sin-registros"
          title="Todavía no hay información para el asistente"
          description="Agrega las políticas que más preguntan los clientes: envíos, formas de pago, devoluciones o garantías."
        >
          <Button onClick={() => setCreating(true)}>Agregar información</Button>
        </EmptyState>
      )
    }
    return (
      <ul className="chatbot-page__list" aria-label="Base de conocimiento del asistente">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`chatbot-entry${entry.active ? '' : ' chatbot-entry--inactive'}`}
          >
            <div className="chatbot-entry__head">
              <h3 className="chatbot-entry__title">{entry.title}</h3>
              <span className={`ui-status ui-status--${entry.active ? 'activo' : 'inactivo'}`}>
                {entry.active ? 'Activa' : 'Inactiva'}
              </span>
              <RowActions
                label={`Acciones para ${entry.title}`}
                actions={[
                  {
                    label: 'Editar',
                    onSelect: () => {
                      setFeedback(null)
                      setEditing(entry)
                    },
                  },
                  {
                    label: entry.active ? 'Desactivar' : 'Activar',
                    onSelect: () => void toggle(entry),
                  },
                  {
                    label: 'Eliminar',
                    onSelect: () => {
                      setFeedback(null)
                      setDeleteError(null)
                      setDeleting(entry)
                    },
                  },
                ]}
              />
            </div>
            <p className="chatbot-entry__content">{entry.content}</p>
          </li>
        ))}
      </ul>
    )
  }

  const available = limits?.internal?.available ?? limits?.visitors?.available
  const budget = limits?.internal?.budget

  return (
    <AppLayout
      title="Chatbot"
      subtitle="Lo que el asistente virtual sabe de la tienda, además de productos y sedes"
    >
      <section className="chatbot-page__summary" aria-label="Estado del asistente">
        <div className="chatbot-page__stat">
          <span className="chatbot-page__stat-label">Estado</span>
          <span
            className={`chatbot-page__stat-value${available === false ? ' chatbot-page__stat-value--off' : ''}`}
          >
            {limits === null ? 'Consultando...' : available ? 'Disponible' : 'Sin configurar'}
          </span>
        </div>
        <div className="chatbot-page__stat">
          <span className="chatbot-page__stat-label">Visitantes de la página</span>
          <span className="chatbot-page__stat-value">
            {limits?.visitors ? `${limits.visitors.limit} mensajes por día` : '—'}
          </span>
        </div>
        <div className="chatbot-page__stat">
          <span className="chatbot-page__stat-label">Usuarios internos</span>
          <span className="chatbot-page__stat-value">
            {limits?.internal ? `${limits.internal.limit} mensajes por hora` : '—'}
          </span>
        </div>
        <div className="chatbot-page__stat">
          <span className="chatbot-page__stat-label">Gasto del mes</span>
          <span className="chatbot-page__stat-value">
            {budget ? `${formatUsd(budget.spentMonthUsd)} de ${formatUsd(budget.monthlyUsd)}` : '—'}
          </span>
          {budget && (
            <span className="chatbot-page__stat-note">
              Hoy {formatUsd(budget.spentTodayUsd)} de {formatUsd(budget.dailyUsd)}
            </span>
          )}
        </div>
        <div className="chatbot-page__stat">
          <span className="chatbot-page__stat-label">Entradas activas</span>
          <span className="chatbot-page__stat-value">
            {current ? `${activeCount} de ${KNOWLEDGE_ACTIVE_LIMIT}` : '—'}
          </span>
        </div>
      </section>

      {available === false && (
        <Alert tone="info">
          El servidor no tiene la API key de Anthropic (ANTHROPIC_API_KEY). Mientras tanto, el
          widget de la página solo ofrece el WhatsApp.
        </Alert>
      )}

      <div className="chatbot-page__toolbar">
        <p className="chatbot-page__hint">
          Productos, precios, disponibilidad y horarios ya los consulta en el sistema. Aquí van las
          políticas y respuestas oficiales; lo que no esté, lo manda al WhatsApp.
        </p>
        <div className="chatbot-page__actions">
          <ReloadButton onReload={reload} loading={current === null} />
          <Button
            onClick={() => {
              setFeedback(null)
              setCreating(true)
            }}
          >
            Agregar información
          </Button>
        </div>
      </div>

      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

      {renderList()}

      <Modal
        open={creating || editing !== null}
        title={editing ? `Editar ${editing.title}` : 'Agregar información'}
        description="El asistente usa esta información tal cual está escrita."
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      >
        {(creating || editing) && (
          <KnowledgeEntryForm
            entry={editing ?? undefined}
            onSaved={(entry) =>
              saved(
                editing
                  ? `Se guardaron los cambios de ${entry.title}.`
                  : `${entry.title} quedó en la base de conocimiento.`,
              )
            }
            onCancel={() => {
              setCreating(false)
              setEditing(null)
            }}
          />
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        title={deleting ? `Eliminar ${deleting.title}` : 'Eliminar información'}
        description="El asistente dejará de usar esta información. No se puede deshacer."
        onClose={() => setDeleting(null)}
      >
        <div className="chatbot-page__confirm">
          {deleteError && <Alert tone="error">{deleteError}</Alert>}
          <div className="category-form__actions">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}

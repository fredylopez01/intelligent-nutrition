import { useContext, useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

import { AuthContext } from '../../context/auth-context'
import { chatService } from '../../services/chat.service'
import {
  CHAT_MESSAGE_MAX_LENGTH,
  WHATSAPP_FALLBACK_URL,
  chatStorageKey,
  describeChatError,
  greeting,
  isBlocked,
  loadChat,
  remainingLabel,
  saveChat,
  type ChatEntry,
  type StoredChat,
} from '../../utils/chat'

import './ChatWidget.css'

type Availability = 'unknown' | 'available' | 'unavailable'

interface ChatWidgetProps {
  variant: 'public' | 'internal'
}

let entrySequence = 0

function entry(author: ChatEntry['author'], text: string, whatsappUrl?: string | null): ChatEntry {
  entrySequence += 1
  return { id: `${Date.now()}-${entrySequence}`, author, text, whatsappUrl }
}

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function WhatsAppLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="chat-widget__whatsapp" href={href} target="_blank" rel="noreferrer">
      <svg {...iconProps}>
        <path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1Z" />
        <path d="M9 9.5c.3 1.8 2.1 3.9 4.3 4.6l1.1-1.1 2 1-.4 1.5c-3.6.4-7.6-3.4-7.6-7.1l1.5-.4 1 2Z" />
      </svg>
      {label}
    </a>
  )
}

export function ChatWidget({ variant }: ChatWidgetProps) {
  const auth = useContext(AuthContext)
  const isPublic = variant === 'public'
  const token = isPublic ? null : (auth?.token ?? null)
  const storageKey = chatStorageKey(isPublic)
  const panelId = useId()
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [chat, setChat] = useState<StoredChat>(() => loadChat(storageKey))
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [availability, setAvailability] = useState<Availability>('unknown')
  const [remaining, setRemaining] = useState<number | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const statusRequested = useRef(false)

  useEffect(() => {
    saveChat(storageKey, chat)
  }, [chat, storageKey])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    if (statusRequested.current) return
    statusRequested.current = true
    chatService
      .status(token)
      .then((status) => setAvailability(status.available ? 'available' : 'unavailable'))
      .catch(() => setAvailability('available'))
  }, [open, token])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      launcherRef.current?.focus()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [chat.entries, sending, open])

  if (!isPublic && !token) return null

  const blocked = isBlocked(chat.blockedUntil)
  const unavailable = availability === 'unavailable'
  const disabled = sending || blocked || unavailable

  const close = () => {
    setOpen(false)
    launcherRef.current?.focus()
  }

  const restart = () => {
    setChat((current) => ({
      conversationId: null,
      entries: [],
      blockedUntil: current.blockedUntil,
    }))
    setRemaining(null)
    inputRef.current?.focus()
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || disabled) return
    setDraft('')
    setSending(true)
    setChat((current) => ({ ...current, entries: [...current.entries, entry('user', text)] }))
    try {
      const reply = await chatService.send(
        { message: text, ...(chat.conversationId ? { conversationId: chat.conversationId } : {}) },
        token,
      )
      setRemaining(reply.remaining)
      setChat((current) => ({
        conversationId: reply.conversationId,
        blockedUntil: null,
        entries: [
          ...current.entries,
          entry(
            'assistant',
            reply.response,
            reply.escalate
              ? (reply.whatsappUrl ?? (isPublic ? WHATSAPP_FALLBACK_URL : null))
              : null,
          ),
        ],
      }))
    } catch (error) {
      const failure = describeChatError(error, isPublic)
      setChat((current) => ({
        ...current,
        blockedUntil: failure.blockedUntil ?? current.blockedUntil,
        entries: [...current.entries, entry('assistant', failure.text, failure.whatsappUrl)],
      }))
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void send()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  const chatWindow = isPublic ? 'day' : 'hour'
  const footerNote = blocked
    ? isPublic
      ? 'Llegaste al límite de mensajes de hoy.'
      : 'Llegaste al límite de mensajes de esta hora.'
    : unavailable
      ? 'El asistente no está disponible en este momento.'
      : remaining !== null
        ? remainingLabel(remaining, chatWindow)
        : 'Las respuestas las genera una IA y pueden tener errores.'

  return (
    <div className={`chat-widget${open ? ' chat-widget--open' : ''}`}>
      {open && (
        <div
          id={panelId}
          className="chat-widget__panel"
          role="dialog"
          aria-label="Asistente virtual de Intelligent Nutrition"
        >
          <header className="chat-widget__header">
            <div className="chat-widget__identity">
              <span className="chat-widget__avatar" aria-hidden="true">
                IN
              </span>
              <div>
                <p className="chat-widget__title">Asistente virtual</p>
                <p className="chat-widget__subtitle">
                  {isPublic ? 'Productos, precios y sedes' : 'Consultas rápidas del negocio'}
                </p>
              </div>
            </div>
            <div className="chat-widget__header-actions">
              {chat.entries.length > 0 && (
                <button
                  type="button"
                  className="chat-widget__icon-button"
                  onClick={restart}
                  aria-label="Empezar una conversación nueva"
                  disabled={sending}
                >
                  <svg {...iconProps}>
                    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
                    <path d="M4 4v4h4" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="chat-widget__icon-button"
                onClick={close}
                aria-label="Minimizar el asistente"
              >
                <svg {...iconProps}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </header>

          {isPublic && (
            <div className="chat-widget__human">
              <span>¿Prefieres hablar con una persona?</span>
              <WhatsAppLink href={WHATSAPP_FALLBACK_URL} label="Hablar con un asesor" />
            </div>
          )}

          <div
            ref={logRef}
            className="chat-widget__log"
            role="log"
            aria-live="polite"
            aria-label="Mensajes de la conversación"
          >
            <p className="chat-widget__bubble chat-widget__bubble--assistant">
              {greeting(isPublic)}
            </p>
            {unavailable && (
              <div className="chat-widget__bubble chat-widget__bubble--assistant">
                <p>
                  {isPublic
                    ? 'El asistente no está disponible en este momento. Escríbenos por WhatsApp y el equipo te atiende.'
                    : 'El asistente no está disponible en este momento. Intenta de nuevo más tarde.'}
                </p>
                {isPublic && (
                  <WhatsAppLink href={WHATSAPP_FALLBACK_URL} label="Escribir por WhatsApp" />
                )}
              </div>
            )}
            {chat.entries.map((item) => (
              <div
                key={item.id}
                className={`chat-widget__bubble chat-widget__bubble--${item.author}`}
              >
                <p>{item.text}</p>
                {item.whatsappUrl && (
                  <WhatsAppLink href={item.whatsappUrl} label="Escribir por WhatsApp" />
                )}
              </div>
            ))}
            {sending && (
              <p className="chat-widget__typing" role="status">
                <span className="chat-widget__dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                Escribiendo…
              </p>
            )}
          </div>

          <form className="chat-widget__form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor={inputId}>
              Escribe tu pregunta
            </label>
            <textarea
              ref={inputRef}
              id={inputId}
              className="chat-widget__input"
              rows={1}
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              placeholder={blocked ? 'Sin mensajes disponibles' : 'Escribe tu pregunta'}
              value={draft}
              disabled={blocked || unavailable}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="submit"
              className="chat-widget__send"
              disabled={disabled || draft.trim() === ''}
              aria-label="Enviar mensaje"
            >
              <svg {...iconProps}>
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          </form>
          <p className="chat-widget__note">{footerNote}</p>
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        className="chat-widget__launcher"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? 'Cerrar el asistente' : 'Abrir el asistente virtual'}
      >
        {open ? (
          <svg {...iconProps}>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg {...iconProps}>
            <path d="M4 5h16v11H9l-5 4Z" />
            <path d="M8 9.5h8M8 12.5h5" />
          </svg>
        )}
      </button>
    </div>
  )
}

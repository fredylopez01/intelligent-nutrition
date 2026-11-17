import { z } from 'zod'

import { ApiError } from '../services/http'
import type { ChatWindow } from '../types/chat'

export const CHAT_MESSAGE_MAX_LENGTH = 500
export const CHAT_STORED_MESSAGES = 30
export const WHATSAPP_DISPLAY = '310 233 2100'
export const WHATSAPP_FALLBACK_URL = `https://wa.me/573102332100?text=${encodeURIComponent(
  'Hola, vengo de la página de Intelligent Nutrition y necesito ayuda con una consulta.',
)}`

export type ChatAuthor = 'user' | 'assistant'

export interface ChatEntry {
  id: string
  author: ChatAuthor
  text: string
  whatsappUrl?: string | null
}

export interface StoredChat {
  conversationId: string | null
  entries: ChatEntry[]
  blockedUntil: string | null
}

export const EMPTY_CHAT: StoredChat = { conversationId: null, entries: [], blockedUntil: null }

export function chatStorageKey(isPublic: boolean): string {
  return isPublic ? 'in-chat:public' : 'in-chat:internal'
}

export function loadChat(key: string): StoredChat {
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return EMPTY_CHAT
    const parsed = JSON.parse(raw) as Partial<StoredChat>
    return {
      conversationId: typeof parsed.conversationId === 'string' ? parsed.conversationId : null,
      entries: Array.isArray(parsed.entries) ? parsed.entries.slice(-CHAT_STORED_MESSAGES) : [],
      blockedUntil: typeof parsed.blockedUntil === 'string' ? parsed.blockedUntil : null,
    }
  } catch {
    return EMPTY_CHAT
  }
}

export function saveChat(key: string, chat: StoredChat) {
  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ ...chat, entries: chat.entries.slice(-CHAT_STORED_MESSAGES) }),
    )
  } catch {
    return
  }
}

export function greeting(isPublic: boolean): string {
  return isPublic
    ? '¡Hola! Soy el asistente de Intelligent Nutrition. Pregúntame por productos, precios, disponibilidad o sedes.'
    : '¡Hola! Pregúntame por productos, precios, disponibilidad por sede u horarios.'
}

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
})

export function remainingLabel(remaining: number, window: ChatWindow): string {
  const period = window === 'day' ? 'hoy' : 'en esta hora'
  if (remaining === 0) return `No te quedan mensajes ${period}.`
  return remaining === 1
    ? `Te queda 1 mensaje ${period}.`
    : `Te quedan ${remaining} mensajes ${period}.`
}

export interface ChatFailure {
  text: string
  whatsappUrl: string | null
  blockedUntil: string | null
}

function detail(error: ApiError, key: string): unknown {
  const details = error.details
  return typeof details === 'object' && details !== null
    ? (details as Record<string, unknown>)[key]
    : undefined
}

export function describeChatError(error: unknown, isPublic: boolean): ChatFailure {
  const whatsapp = isPublic ? WHATSAPP_FALLBACK_URL : null
  if (!(error instanceof ApiError)) {
    return {
      text: 'No pude conectarme con el asistente. Revisa tu conexión e intenta de nuevo.',
      whatsappUrl: whatsapp,
      blockedUntil: null,
    }
  }
  const detailUrl = detail(error, 'whatsappUrl')
  const whatsappUrl = typeof detailUrl === 'string' ? detailUrl : whatsapp
  const retryAt = detail(error, 'retryAt')
  const blockedUntil = typeof retryAt === 'string' ? retryAt : null
  switch (error.code) {
    case 'CHAT_RATE_LIMIT': {
      const limit = Number(detail(error, 'limit'))
      if (isPublic) {
        return {
          text: `Llegaste al límite de ${limit || 5} mensajes de hoy. Para completar tu consulta, escríbenos por WhatsApp al ${WHATSAPP_DISPLAY} y el equipo te atiende.`,
          whatsappUrl,
          blockedUntil,
        }
      }
      return {
        text: `Llegaste al límite de ${limit || 10} mensajes por hora.${
          blockedUntil
            ? ` Puedes volver a escribir a las ${timeFormatter.format(new Date(blockedUntil))}.`
            : ''
        }`,
        whatsappUrl: null,
        blockedUntil,
      }
    }
    case 'CHAT_DAILY_LIMIT': {
      const period = detail(error, 'window') === 'month' ? 'este mes' : 'hoy'
      return {
        text: isPublic
          ? `El asistente ya atendió todas las consultas que puede por ${period}. Escríbenos por WhatsApp al ${WHATSAPP_DISPLAY} y el equipo te atiende.`
          : `El asistente ya atendió todas las consultas que puede por ${period}. ${
              period === 'hoy' ? 'Vuelve a intentarlo mañana.' : 'Vuelve el próximo mes.'
            }`,
        whatsappUrl,
        blockedUntil,
      }
    }
    case 'CHAT_UNAVAILABLE':
      return {
        text: isPublic
          ? `El asistente no está disponible en este momento. Escríbenos por WhatsApp al ${WHATSAPP_DISPLAY}.`
          : 'El asistente no está disponible en este momento. Intenta de nuevo más tarde.',
        whatsappUrl,
        blockedUntil: null,
      }
  }
  if (error.status === 400) {
    return {
      text: `Escribe un mensaje de máximo ${CHAT_MESSAGE_MAX_LENGTH} caracteres.`,
      whatsappUrl: null,
      blockedUntil: null,
    }
  }
  return {
    text: 'El asistente no pudo responder. Intenta de nuevo en un momento.',
    whatsappUrl: whatsapp,
    blockedUntil: null,
  }
}

export function isBlocked(blockedUntil: string | null, now = Date.now()): boolean {
  return blockedUntil !== null && new Date(blockedUntil).getTime() > now
}

export const KNOWLEDGE_TITLE_MAX_LENGTH = 150
export const KNOWLEDGE_CONTENT_MAX_LENGTH = 1500
export const KNOWLEDGE_ACTIVE_LIMIT = 30

export const knowledgeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'El tema debe tener al menos 3 caracteres.')
    .max(
      KNOWLEDGE_TITLE_MAX_LENGTH,
      `El tema no puede superar los ${KNOWLEDGE_TITLE_MAX_LENGTH} caracteres.`,
    ),
  content: z
    .string()
    .trim()
    .min(10, 'Escribe la información con al menos 10 caracteres.')
    .max(
      KNOWLEDGE_CONTENT_MAX_LENGTH,
      `La información no puede superar los ${KNOWLEDGE_CONTENT_MAX_LENGTH} caracteres.`,
    ),
  active: z.boolean(),
})

export type KnowledgeFormValues = z.infer<typeof knowledgeSchema>

export function resolveKnowledgeError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case 'CHAT_KNOWLEDGE_LIMIT':
      return `Solo puede haber ${KNOWLEDGE_ACTIVE_LIMIT} entradas activas. Desactiva o elimina alguna antes.`
    case 'CHAT_KNOWLEDGE_NOT_FOUND':
      return 'La entrada ya no existe. Recarga la lista.'
  }
  if (error.status === 403)
    return 'Solo el superadministrador puede cambiar la base de conocimiento.'
  if (error.status === 400) return 'Revisa los datos: hay un valor que el servidor no aceptó.'
  return fallback
}

const usdFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatUsd(value: number): string {
  return usdFormatter.format(value)
}

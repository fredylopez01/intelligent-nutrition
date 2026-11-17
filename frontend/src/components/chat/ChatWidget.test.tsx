import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../context/auth-context'
import { chatService } from '../../services/chat.service'
import { ApiError } from '../../services/http'
import type { AuthState } from '../../types/auth'
import type { ChatReply } from '../../types/chat'

import { ChatWidget } from './ChatWidget'

vi.mock('../../services/chat.service', () => ({
  chatService: { status: vi.fn(), send: vi.fn() },
}))

const status = vi.mocked(chatService.status)
const send = vi.mocked(chatService.send)

function reply(overrides: Partial<ChatReply> = {}): ChatReply {
  return {
    conversationId: 'conv-1',
    response: 'La creatina cuesta $ 99.900.',
    escalate: false,
    whatsappUrl: 'https://wa.me/573102332100?text=hola',
    limit: 5,
    remaining: 4,
    ...overrides,
  }
}

function renderWidget(variant: 'public' | 'internal', token: string | null = null) {
  const user = userEvent.setup()
  const auth = { token, user: null } as unknown as AuthState
  render(
    <AuthContext.Provider value={auth}>
      <ChatWidget variant={variant} />
    </AuthContext.Provider>,
  )
  return user
}

async function openChat(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Abrir el asistente virtual' }))
  return within(screen.getByRole('dialog', { name: 'Asistente virtual de Intelligent Nutrition' }))
}

beforeEach(() => {
  vi.resetAllMocks()
  window.sessionStorage.clear()
  status.mockResolvedValue({
    available: true,
    limit: 5,
    window: 'day',
    whatsappUrl: 'https://wa.me/573102332100',
  })
  send.mockResolvedValue(reply())
})

afterEach(() => {
  window.sessionStorage.clear()
})

describe('ChatWidget for visitors', () => {
  it('opens with a greeting and a way to talk to a person', async () => {
    const user = renderWidget('public')

    const panel = await openChat(user)

    expect(panel.getByText(/Soy el asistente de Intelligent Nutrition/)).toBeInTheDocument()
    expect(panel.getByRole('link', { name: 'Hablar con un asesor' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/573102332100'),
    )
    expect(panel.getByLabelText('Escribe tu pregunta')).toHaveFocus()
    expect(status).toHaveBeenCalledWith(null)
  })

  it('sends the question, shows the answer and keeps the conversation', async () => {
    const user = renderWidget('public')
    const panel = await openChat(user)

    await user.type(panel.getByLabelText('Escribe tu pregunta'), '¿Cuánto vale la creatina?{Enter}')

    expect(await panel.findByText('La creatina cuesta $ 99.900.')).toBeInTheDocument()
    expect(panel.getByText('¿Cuánto vale la creatina?')).toBeInTheDocument()
    expect(panel.getByText('Te quedan 4 mensajes hoy.')).toBeInTheDocument()
    expect(send).toHaveBeenCalledWith({ message: '¿Cuánto vale la creatina?' }, null)

    await user.type(panel.getByLabelText('Escribe tu pregunta'), '¿Y en Tunja?')
    await user.click(panel.getByRole('button', { name: 'Enviar mensaje' }))

    await waitFor(() =>
      expect(send).toHaveBeenLastCalledWith(
        { message: '¿Y en Tunja?', conversationId: 'conv-1' },
        null,
      ),
    )
  })

  it('offers WhatsApp when the assistant escalates', async () => {
    send.mockResolvedValue(
      reply({ response: 'Escríbenos al WhatsApp 310 233 2100.', escalate: true }),
    )
    const user = renderWidget('public')
    const panel = await openChat(user)

    await user.type(panel.getByLabelText('Escribe tu pregunta'), '¿Dónde está mi pedido?{Enter}')

    const bubble = (await panel.findByText('Escríbenos al WhatsApp 310 233 2100.')).closest(
      'div',
    ) as HTMLElement
    expect(within(bubble).getByRole('link', { name: 'Escribir por WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/573102332100?text=hola',
    )
  })

  it('sends the visitor to WhatsApp after the daily limit and blocks the input', async () => {
    send.mockRejectedValue(
      new ApiError(
        'Limit',
        429,
        {
          limit: 5,
          window: 'day',
          retryAt: '2999-01-01T05:00:00.000Z',
          whatsappUrl: 'https://wa.me/573102332100?text=limite',
        },
        'CHAT_RATE_LIMIT',
      ),
    )
    const user = renderWidget('public')
    const panel = await openChat(user)

    await user.type(panel.getByLabelText('Escribe tu pregunta'), 'Hola{Enter}')

    expect(
      await panel.findByText(
        /Llegaste al límite de 5 mensajes de hoy\. Para completar tu consulta/,
      ),
    ).toBeInTheDocument()
    expect(panel.getByRole('link', { name: 'Escribir por WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/573102332100?text=limite',
    )
    expect(panel.getByLabelText('Escribe tu pregunta')).toBeDisabled()
    expect(panel.getByText('Llegaste al límite de mensajes de hoy.')).toBeInTheDocument()
  })

  it('explains when the assistant is not configured', async () => {
    status.mockResolvedValue({
      available: false,
      limit: 5,
      window: 'day',
      whatsappUrl: 'https://wa.me/573102332100',
    })
    const user = renderWidget('public')

    const panel = await openChat(user)

    expect(
      await panel.findByText(/El asistente no está disponible en este momento\. Escríbenos/),
    ).toBeInTheDocument()
    expect(panel.getByLabelText('Escribe tu pregunta')).toBeDisabled()
  })

  it('keeps the messages when the page changes and starts over on demand', async () => {
    const user = renderWidget('public')
    const panel = await openChat(user)
    await user.type(panel.getByLabelText('Escribe tu pregunta'), 'Hola{Enter}')
    await panel.findByText('La creatina cuesta $ 99.900.')

    expect(JSON.parse(window.sessionStorage.getItem('in-chat:public') ?? '{}')).toMatchObject({
      conversationId: 'conv-1',
      entries: [
        { author: 'user', text: 'Hola' },
        { author: 'assistant', text: 'La creatina cuesta $ 99.900.' },
      ],
    })

    await user.click(panel.getByRole('button', { name: 'Empezar una conversación nueva' }))

    expect(panel.queryByText('La creatina cuesta $ 99.900.')).not.toBeInTheDocument()
  })

  it('closes with Escape and returns the focus to the launcher', async () => {
    const user = renderWidget('public')
    await openChat(user)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir el asistente virtual' })).toHaveFocus()
  })
})

describe('ChatWidget for the team', () => {
  it('uses the session and tells when the hourly limit resets', async () => {
    send.mockRejectedValue(
      new ApiError(
        'Limit',
        429,
        { limit: 10, window: 'hour', retryAt: '2999-01-01T20:30:00.000Z', whatsappUrl: null },
        'CHAT_RATE_LIMIT',
      ),
    )
    const user = renderWidget('internal', 'token-1')
    const panel = await openChat(user)

    expect(panel.queryByRole('link', { name: 'Hablar con un asesor' })).not.toBeInTheDocument()
    await user.type(panel.getByLabelText('Escribe tu pregunta'), 'Hola{Enter}')

    expect(
      await panel.findByText(
        /Llegaste al límite de 10 mensajes por hora\. Puedes volver a escribir a las/,
      ),
    ).toBeInTheDocument()
    expect(panel.queryByRole('link', { name: 'Escribir por WhatsApp' })).not.toBeInTheDocument()
    expect(send).toHaveBeenCalledWith({ message: 'Hola' }, 'token-1')
    expect(status).toHaveBeenCalledWith('token-1')
  })

  it('does not render without a session', () => {
    renderWidget('internal', null)

    expect(
      screen.queryByRole('button', { name: 'Abrir el asistente virtual' }),
    ).not.toBeInTheDocument()
  })
})

describe('ChatWidget when the budget runs out', () => {
  it('sends the visitor to WhatsApp when the monthly budget is spent', async () => {
    send.mockRejectedValue(
      new ApiError(
        'Budget',
        429,
        {
          window: 'month',
          retryAt: '2999-01-01T05:00:00.000Z',
          whatsappUrl: 'https://wa.me/573102332100?text=presupuesto',
        },
        'CHAT_DAILY_LIMIT',
      ),
    )
    const user = renderWidget('public')
    const panel = await openChat(user)

    await user.type(panel.getByLabelText('Escribe tu pregunta'), 'Hola{Enter}')

    expect(
      await panel.findByText(
        /todas las consultas que puede por este mes\. Escríbenos por WhatsApp/,
      ),
    ).toBeInTheDocument()
    expect(panel.getByRole('link', { name: 'Escribir por WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/573102332100?text=presupuesto',
    )
  })
})

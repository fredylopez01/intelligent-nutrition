import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { chatService } from '../../services/chat.service'
import { ApiError } from '../../services/http'
import type { ChatKnowledgeEntry } from '../../types/chat'

import { ChatbotPage } from './ChatbotPage'

vi.mock('../../services/chat.service', () => ({
  chatService: {
    status: vi.fn(),
    listKnowledge: vi.fn(),
    createKnowledge: vi.fn(),
    updateKnowledge: vi.fn(),
    removeKnowledge: vi.fn(),
  },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'me', role: { name: 'SUPERADMIN' } } }),
}))

vi.mock('../../layouts/AppLayout', () => ({
  AppLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

const SHIPPING: ChatKnowledgeEntry = {
  id: 'k1',
  title: 'Envíos',
  content: 'Los domicilios se coordinan por WhatsApp.',
  active: true,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
}
const PAYMENTS: ChatKnowledgeEntry = {
  ...SHIPPING,
  id: 'k2',
  title: 'Formas de pago',
  content: 'Efectivo, tarjeta y transferencia.',
  active: false,
}

function renderPage() {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <ChatbotPage />
    </MemoryRouter>,
  )
  return user
}

async function openActions(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  action: string,
) {
  await user.click(screen.getByRole('button', { name: `Acciones para ${title}` }))
  await user.click(screen.getByRole('menuitem', { name: action }))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(chatService.listKnowledge).mockResolvedValue([SHIPPING, PAYMENTS])
  vi.mocked(chatService.status).mockImplementation((token) =>
    Promise.resolve(
      token
        ? {
            available: true,
            limit: 10,
            window: 'hour',
            whatsappUrl: null,
            budget: { monthlyUsd: 4.5, dailyUsd: 0.15, spentMonthUsd: 1.2346, spentTodayUsd: 0.05 },
          }
        : { available: true, limit: 5, window: 'day', whatsappUrl: 'https://wa.me/573102332100' },
    ),
  )
})

describe('ChatbotPage', () => {
  it('shows the status, the limits and the knowledge entries', async () => {
    renderPage()

    expect(await screen.findByText('Envíos')).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.getByText('5 mensajes por día')).toBeInTheDocument()
    expect(screen.getByText('10 mensajes por hora')).toBeInTheDocument()
    expect(screen.getByText('1 de 30')).toBeInTheDocument()
    expect(screen.getByText('US$ 1,23 de US$ 4,50')).toBeInTheDocument()
    expect(screen.getByText('Hoy US$ 0,05 de US$ 0,15')).toBeInTheDocument()
    expect(
      within(screen.getByText('Formas de pago').closest('li') as HTMLElement).getByText('Inactiva'),
    ).toBeInTheDocument()
  })

  it('warns when the API key is missing', async () => {
    vi.mocked(chatService.status).mockResolvedValue({
      available: false,
      limit: 5,
      window: 'day',
      whatsappUrl: null,
    })
    renderPage()

    expect(await screen.findByText('Sin configurar')).toBeInTheDocument()
    expect(screen.getByText(/no tiene la API key de Anthropic/)).toBeInTheDocument()
  })

  it('adds an entry for the assistant', async () => {
    vi.mocked(chatService.createKnowledge).mockResolvedValue({
      ...SHIPPING,
      id: 'k3',
      title: 'Devoluciones',
    })
    const user = renderPage()
    await screen.findByText('Envíos')

    await user.click(screen.getByRole('button', { name: 'Agregar información' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Agregar información' }))
    await user.click(dialog.getByRole('button', { name: 'Agregar información' }))
    expect(await dialog.findByText('El tema debe tener al menos 3 caracteres.')).toBeInTheDocument()

    await user.type(dialog.getByLabelText('Tema'), 'Devoluciones')
    await user.type(
      dialog.getByLabelText('Información para el asistente'),
      'Se aceptan devoluciones con factura dentro de los 5 días.',
    )
    await user.click(dialog.getByRole('button', { name: 'Agregar información' }))

    await waitFor(() =>
      expect(chatService.createKnowledge).toHaveBeenCalledWith(
        {
          title: 'Devoluciones',
          content: 'Se aceptan devoluciones con factura dentro de los 5 días.',
          active: true,
        },
        'test-token',
      ),
    )
    expect(
      await screen.findByText('Devoluciones quedó en la base de conocimiento.'),
    ).toBeInTheDocument()
  })

  it('edits only what changed', async () => {
    vi.mocked(chatService.updateKnowledge).mockResolvedValue({ ...SHIPPING, title: 'Domicilios' })
    const user = renderPage()
    await screen.findByText('Envíos')

    await openActions(user, 'Envíos', 'Editar')
    const dialog = within(screen.getByRole('dialog', { name: 'Editar Envíos' }))
    await user.clear(dialog.getByLabelText('Tema'))
    await user.type(dialog.getByLabelText('Tema'), 'Domicilios')
    await user.click(dialog.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(chatService.updateKnowledge).toHaveBeenCalledWith(
        'k1',
        { title: 'Domicilios' },
        'test-token',
      ),
    )
  })

  it('explains the limit of active entries', async () => {
    vi.mocked(chatService.updateKnowledge).mockRejectedValue(
      new ApiError('Limit', 422, { limit: 30 }, 'CHAT_KNOWLEDGE_LIMIT'),
    )
    const user = renderPage()
    await screen.findByText('Formas de pago')

    await openActions(user, 'Formas de pago', 'Activar')

    expect(
      await screen.findByText(
        'Solo puede haber 30 entradas activas. Desactiva o elimina alguna antes.',
      ),
    ).toBeInTheDocument()
    expect(chatService.updateKnowledge).toHaveBeenCalledWith('k2', { active: true }, 'test-token')
  })

  it('deletes an entry after confirming', async () => {
    vi.mocked(chatService.removeKnowledge).mockResolvedValue({ message: 'ok' })
    const user = renderPage()
    await screen.findByText('Envíos')

    await openActions(user, 'Envíos', 'Eliminar')
    const dialog = within(screen.getByRole('dialog', { name: 'Eliminar Envíos' }))
    await user.click(dialog.getByRole('button', { name: 'Eliminar' }))

    await waitFor(() =>
      expect(chatService.removeKnowledge).toHaveBeenCalledWith('k1', 'test-token'),
    )
    expect(await screen.findByText('Se eliminó Envíos.')).toBeInTheDocument()
  })
})

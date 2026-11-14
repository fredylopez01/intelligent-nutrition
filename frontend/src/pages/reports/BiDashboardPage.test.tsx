import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { reportsService } from '../../services/reports.service'

import { BiDashboardPage } from './BiDashboardPage'

vi.mock('../../services/reports.service', () => ({
  reportsService: { dashboardEmbed: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'me', role: { name: 'SUPERADMIN' } },
  }),
}))

vi.mock('../../layouts/AppLayout', () => ({
  AppLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

const dashboardEmbed = vi.mocked(reportsService.dashboardEmbed)
const EMBED_URL = 'https://lookerstudio.google.com/embed/reporting/report-id/page/page-id'
const FRAME_TITLE = 'Dashboard de ventas, compras e inventario'
const NEW_TAB_LINK = 'Abrir en una pestaña nueva'

function renderPage() {
  const user = userEvent.setup()
  render(<BiDashboardPage />)
  return { user }
}

beforeEach(() => {
  vi.resetAllMocks()
  dashboardEmbed.mockResolvedValue({ url: EMBED_URL })
})

describe('BiDashboardPage', () => {
  it('shows a loading placeholder while the URL is requested', () => {
    dashboardEmbed.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Cargando el dashboard...')).toBeInTheDocument()
    expect(screen.queryByTitle(FRAME_TITLE)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: NEW_TAB_LINK })).not.toBeInTheDocument()
  })

  it('embeds the report in an iframe with the URL given by the server', async () => {
    renderPage()

    const frame = await screen.findByTitle(FRAME_TITLE)

    expect(frame).toHaveAttribute('src', EMBED_URL)
    expect(frame).toHaveAttribute('sandbox', expect.stringContaining('allow-popups'))
    expect(frame).toHaveAttribute('allowfullscreen')
    expect(dashboardEmbed).toHaveBeenCalledWith('test-token')
    expect(screen.queryByText('Cargando el dashboard...')).not.toBeInTheDocument()
  })

  it('opens the report in a new tab without giving it access to the app', async () => {
    renderPage()

    const link = await screen.findByRole('link', { name: NEW_TAB_LINK })

    expect(link).toHaveAttribute('href', EMBED_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('reminds that a Google account with access is needed', async () => {
    renderPage()

    await screen.findByTitle(FRAME_TITLE)

    expect(
      screen.getByText(/iniciado sesión en Google con una cuenta autorizada/),
    ).toBeInTheDocument()
  })

  it('explains that the dashboard is not configured and lets the user retry', async () => {
    dashboardEmbed.mockRejectedValueOnce(
      new ApiError('x', 503, undefined, 'DASHBOARD_NOT_CONFIGURED'),
    )
    const { user } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/todavía no está configurado/)
    expect(screen.queryByTitle(FRAME_TITLE)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: NEW_TAB_LINK })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByTitle(FRAME_TITLE)).toHaveAttribute('src', EMBED_URL)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(dashboardEmbed).toHaveBeenCalledTimes(2)
  })

  it('shows a generic message when the request fails for another reason', async () => {
    dashboardEmbed.mockRejectedValue(new Error('network down'))

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible cargar el dashboard. Intenta de nuevo.',
    )
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

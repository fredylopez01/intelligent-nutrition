import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { reportsService } from '../../services/reports.service'
import type { SalesReportParams, SalesReportRow } from '../../types/report'
import { defaultReportRange } from '../../utils/reports'

import { ReportsPage } from './ReportsPage'

const auth = vi.hoisted(() => ({
  role: 'BRANCH_LEADER',
  branches: [] as { id: string; name: string }[],
}))

vi.mock('../../services/reports.service', () => ({
  reportsService: { sales: vi.fn() },
}))

vi.mock('../../services/branches.service', () => ({
  branchesService: { list: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'me', role: { name: auth.role }, branches: auth.branches },
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

const sales = vi.mocked(reportsService.sales)
const RANGE = '?desde=2026-11-01&hasta=2026-11-12'

const centro = { id: 'branch-centro', name: 'Centro' }
const norte = { id: 'branch-norte', name: 'Norte' }

function row(day: string, branch: typeof centro, salesCount: number, totalAmount: string) {
  return { day, branch, salesCount, totalAmount }
}

function page(data: SalesReportRow[], meta: Partial<{ total: number; totalPages: number }> = {}) {
  return {
    data,
    meta: {
      page: 1,
      limit: 20,
      total: meta.total ?? data.length,
      totalPages: meta.totalPages ?? (data.length ? 1 : 0),
    },
  }
}

function lastParams(): SalesReportParams {
  const call = sales.mock.lastCall
  if (!call) throw new Error('The sales report was never requested')
  return call[0]
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

function renderPage(path = `/reportes${RANGE}`) {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <ReportsPage />
      <LocationProbe />
    </MemoryRouter>,
  )
  return { user, url: () => screen.getByTestId('location').textContent }
}

async function useSuperadmin() {
  auth.role = 'SUPERADMIN'
  auth.branches = []
  const { branchesService } = await import('../../services/branches.service')
  vi.mocked(branchesService.list).mockResolvedValue({
    data: [
      { ...centro, active: true, address: 'Calle 1', phone: '1' },
      { ...norte, active: true, address: 'Calle 2', phone: '2' },
    ],
    meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
  } as never)
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.role = 'BRANCH_LEADER'
  auth.branches = [centro]
  sales.mockResolvedValue(
    page([row('2026-11-12', centro, 2, '410291.00'), row('2026-11-10', centro, 1, '312700.00')]),
  )
})

describe('ReportsPage', () => {
  it('shows the sales of the period by day with the summary', async () => {
    renderPage()

    const table = await screen.findByRole('table', { name: /Ventas por día/ })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((item) => item.textContent?.replace(/\s/g, ' '))).toEqual([
      '12 nov 20262$ 205.145,50$ 410.291',
      '10 nov 20261$ 312.700$ 312.700',
    ])
    const summary = within(screen.getByLabelText('Resumen del período'))
    expect(summary.getByText('$ 722.991')).toBeInTheDocument()
    expect(summary.getByText('3')).toBeInTheDocument()
    expect(summary.getByText('$ 240.997')).toBeInTheDocument()
    expect(lastParams()).toEqual({
      page: 1,
      limit: 20,
      branchId: 'branch-centro',
      from: '2026-11-01',
      to: '2026-11-12',
    })
  })

  it('reports the last 30 days when no dates are chosen', async () => {
    renderPage('/reportes')

    await screen.findByRole('table')
    expect(lastParams()).toMatchObject(defaultReportRange())
    expect(screen.getByLabelText('Desde')).toHaveValue(defaultReportRange().from)
  })

  it('filters by dates and keeps them in the url', async () => {
    const { url } = renderPage()
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-05' } })

    await waitFor(() => expect(lastParams()).toMatchObject({ from: '2026-11-05', page: 1 }))
    expect(url()).toContain('desde=2026-11-05')
  })

  it('does not ask for the report with an inverted range', async () => {
    renderPage('/reportes?desde=2026-11-12&hasta=2026-11-01')

    expect(
      await screen.findByText('La fecha inicial debe ser anterior o igual a la fecha final.'),
    ).toBeInTheDocument()
    expect(sales).not.toHaveBeenCalled()
  })

  it('lets the superadmin see every branch or pick one', async () => {
    await useSuperadmin()
    sales.mockResolvedValue(
      page([row('2026-11-12', centro, 1, '100000.00'), row('2026-11-12', norte, 1, '50000.00')]),
    )
    const { user, url } = renderPage()

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Sede' })).toBeInTheDocument()
    expect(lastParams().branchId).toBeUndefined()
    expect(
      within(screen.getByLabelText('Sede'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todas las sedes', 'Centro', 'Norte'])

    await user.selectOptions(screen.getByLabelText('Sede'), 'branch-norte')

    await waitFor(() => expect(lastParams().branchId).toBe('branch-norte'))
    expect(url()).toContain('sede=branch-norte')
  })

  it('warns that the summary only adds the current page', async () => {
    sales.mockResolvedValue(
      page([row('2026-11-12', centro, 2, '410291.00')], { total: 40, totalPages: 2 }),
    )
    renderPage()

    expect(await screen.findByText(/El resumen suma los días de esta página/)).toBeInTheDocument()
  })

  it('shows the loading state while the report arrives', () => {
    sales.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByText('Cargando el reporte de ventas...')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the error and retries', async () => {
    sales.mockRejectedValueOnce(new ApiError('Scope', 403, undefined, 'BRANCH_SCOPE_VIOLATION'))
    const { user } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes acceso a esta sede.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('explains a period without sales', async () => {
    sales.mockResolvedValue(page([]))
    renderPage()

    expect(await screen.findByText('No hay ventas en este período')).toBeInTheDocument()
    expect(screen.getByText(/Centro no tiene ventas completadas/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Resumen del período')).not.toBeInTheDocument()
  })

  it('stops a branch leader without branches', async () => {
    auth.branches = []
    renderPage()

    expect(await screen.findByText('No tienes sedes asignadas')).toBeInTheDocument()
    expect(sales).not.toHaveBeenCalled()
  })
})

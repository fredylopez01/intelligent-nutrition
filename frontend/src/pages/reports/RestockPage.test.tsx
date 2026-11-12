import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { reportsService } from '../../services/reports.service'
import type { RestockReportRow } from '../../types/report'

import { RestockPage } from './RestockPage'

const auth = vi.hoisted(() => ({
  role: 'BRANCH_LEADER',
  branches: [] as { id: string; name: string }[],
}))

vi.mock('../../services/reports.service', () => ({
  reportsService: { restock: vi.fn() },
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

const restock = vi.mocked(reportsService.restock)
const centro = { id: 'branch-centro', name: 'Centro' }
const norte = { id: 'branch-norte', name: 'Norte' }

function row(overrides: Partial<RestockReportRow> = {}): RestockReportRow {
  return {
    productId: 'product-whey',
    name: 'Whey Protein 2 lb',
    referenceCode: 'WHEY-2LB',
    branchId: centro.id,
    branchName: centro.name,
    currentQuantity: 5,
    minimumStock: 10,
    deficit: 5,
    projectedDemand7d: 14,
    suggestedUnits: 9,
    ...overrides,
  }
}

const creatine = row({
  productId: 'product-creatine',
  name: 'Creatina 300 g',
  referenceCode: 'CREA-300',
  currentQuantity: 0,
  minimumStock: 20,
  deficit: 20,
  projectedDemand7d: 0,
  suggestedUnits: 20,
})

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

function renderPage(path = '/reportes/reposicion') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <RestockPage />
      <LocationProbe />
    </MemoryRouter>,
  )
  return { user, url: () => screen.getByTestId('location').textContent }
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.role = 'BRANCH_LEADER'
  auth.branches = [centro]
  restock.mockResolvedValue([row(), creatine])
})

describe('RestockPage', () => {
  it('lists the products below their minimum with stock, demand and units to restock', async () => {
    renderPage()

    const table = await screen.findByRole('table', { name: /stock por debajo del mínimo/ })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((item) => item.textContent)).toEqual([
      'Whey Protein 2 lbWHEY-2LB5 und10 und14 und9 und',
      'Creatina 300 gCREA-3000 und20 und0 und20 und',
    ])
    expect(within(table).getByRole('columnheader', { name: 'Demanda 7 días' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Reponer' })).toBeInTheDocument()
    expect(restock).toHaveBeenCalledWith({ branchId: 'branch-centro' }, 'test-token')
  })

  it('sums the products and the suggested units and explains the calculation', async () => {
    renderPage()

    const summary = within(await screen.findByLabelText('Resumen de la reposición'))
    expect(summary.getByText('2')).toBeInTheDocument()
    expect(summary.getByText('29 und')).toBeInTheDocument()
    expect(
      summary.getByText(/promedio diario de ventas de los últimos 30 días/),
    ).toBeInTheDocument()
  })

  it('lets the superadmin see every branch or pick one', async () => {
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
    restock.mockResolvedValue([row(), row({ branchId: norte.id, branchName: norte.name })])
    const { user, url } = renderPage()

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Sede' })).toBeInTheDocument()
    expect(restock).toHaveBeenLastCalledWith({ branchId: undefined }, 'test-token')

    await user.selectOptions(screen.getByLabelText('Sede'), 'branch-norte')

    await waitFor(() =>
      expect(restock).toHaveBeenLastCalledWith({ branchId: 'branch-norte' }, 'test-token'),
    )
    expect(url()).toContain('sede=branch-norte')
  })

  it('shows the loading state while the report is calculated', () => {
    restock.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByText('Calculando la reposición sugerida...')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the error and retries', async () => {
    restock.mockRejectedValueOnce(new ApiError('down', 500))
    const { user } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible cargar la reposición sugerida. Intenta de nuevo.',
    )
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('says when nothing needs to be restocked', async () => {
    restock.mockResolvedValue([])
    renderPage()

    expect(
      await screen.findByText('Ningún producto está por debajo de su stock mínimo'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Resumen de la reposición')).not.toBeInTheDocument()
  })

  it('stops a branch leader without branches', async () => {
    auth.branches = []
    renderPage()

    expect(await screen.findByText('No tienes sedes asignadas')).toBeInTheDocument()
    expect(restock).not.toHaveBeenCalled()
  })
})

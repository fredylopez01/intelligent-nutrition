import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { branchesService } from '../../services/branches.service'
import { dashboardService } from '../../services/dashboard.service'
import { ApiError } from '../../services/http'
import type { BranchDashboard } from '../../types/dashboard'

import { DashboardPage } from './DashboardPage'

const auth = vi.hoisted(() => ({
  role: 'BRANCH_LEADER',
  branches: [] as { id: string; name: string }[],
}))

vi.mock('../../services/dashboard.service', () => ({
  dashboardService: { branch: vi.fn(), global: vi.fn() },
}))

vi.mock('../../services/branches.service', () => ({
  branchesService: { list: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: {
      id: 'me',
      fullName: 'Natalia Bernal',
      role: { name: auth.role },
      branches: auth.branches,
    },
  }),
}))

vi.mock('../../layouts/AppLayout', () => ({
  AppLayout: ({
    title,
    subtitle,
    actions,
    children,
  }: {
    title: string
    subtitle?: string
    actions?: ReactNode
    children: ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {actions}
      {children}
    </main>
  ),
}))

const branchDashboard = vi.mocked(dashboardService.branch)
const globalDashboard = vi.mocked(dashboardService.global)
const listBranches = vi.mocked(branchesService.list)
const makro = { id: 'branch-makro', name: 'Intelligent Nutrition - Makro' }
const viva = { id: 'branch-viva', name: 'Sede Viva' }

function dashboard(overrides: Partial<BranchDashboard> = {}): BranchDashboard {
  return {
    date: '2026-11-12',
    branch: makro,
    salesToday: { count: 12, totalAmount: 2418600 },
    salesYesterdayUntilNow: 2106300,
    salesLast7Days: [
      { date: '2026-11-06', totalAmount: 900000 },
      { date: '2026-11-07', totalAmount: 1200000 },
      { date: '2026-11-08', totalAmount: 1000000 },
      { date: '2026-11-09', totalAmount: 1600000 },
      { date: '2026-11-10', totalAmount: 1400000 },
      { date: '2026-11-11', totalAmount: 1950000 },
      { date: '2026-11-12', totalAmount: 2418600 },
    ],
    uniqueCustomersToday: 8,
    criticalStockProducts: 2,
    monthlyRevenue: 18500000,
    stock: {
      totalUnits: 1284,
      byCategory: [
        { categoryId: 'c-1', name: 'Proteína', units: 612 },
        { categoryId: 'c-2', name: 'Creatina', units: 418 },
        { categoryId: 'c-3', name: 'Pre-entreno', units: 254 },
      ],
    },
    branches: {
      active: 1,
      open: 1,
      items: [{ branchId: makro.id, name: makro.name, open: true, salesToday: 2418600 }],
    },
    alerts: {
      total: 4,
      lowStockProducts: 1,
      items: [
        {
          type: 'OUT_OF_STOCK',
          productId: 'p-1',
          productName: 'Dymatize Elite Whey 5lb',
          referenceCode: 'DYM',
          quantity: 0,
          branches: [makro, viva],
          expirationDate: null,
        },
        {
          type: 'LAST_UNIT',
          productId: 'p-2',
          productName: 'Iron Creatina Ultra Pure 500g',
          referenceCode: 'IRON',
          quantity: 1,
          branches: [viva],
          expirationDate: null,
        },
        {
          type: 'BELOW_MINIMUM',
          productId: 'p-3',
          productName: 'Proscience Best Protein 2lb',
          referenceCode: 'BEST',
          quantity: 3,
          branches: [viva],
          expirationDate: null,
        },
        {
          type: 'EXPIRING',
          productId: 'p-4',
          productName: 'Insane Labz Psychotic Gold',
          referenceCode: 'PSY',
          quantity: 8,
          branches: [makro],
          expirationDate: '2026-12-27',
        },
      ],
    },
    topProducts: [
      {
        productId: 'p-5',
        name: 'Best Whey Vainilla 5lb',
        referenceCode: 'BW',
        quantity: 7,
        total: 1,
      },
      { productId: 'p-6', name: 'Creatina Legacy', referenceCode: 'CL', quantity: 5, total: 1 },
    ],
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

function renderPage(path = '/dashboard') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <DashboardPage />
      <LocationProbe />
    </MemoryRouter>,
  )
  return { user, url: () => screen.getByTestId('location').textContent }
}

async function panel(name: string) {
  return within(await screen.findByRole('region', { name }))
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.role = 'BRANCH_LEADER'
  auth.branches = [makro]
  branchDashboard.mockResolvedValue(dashboard())
  globalDashboard.mockResolvedValue(
    dashboard({
      branch: null,
      branches: {
        active: 2,
        open: 1,
        items: [
          { branchId: viva.id, name: viva.name, open: false, salesToday: 872400 },
          { branchId: makro.id, name: makro.name, open: true, salesToday: 1104200 },
        ],
      },
    }),
  )
})

describe('DashboardPage', () => {
  it('greets the user with the day and the sales against yesterday', async () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Hola, Natalia' })).toBeInTheDocument()
    const sales = await panel('Ventas de hoy')
    expect(await sales.findByText(/2\.418\.600/, { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Jueves 12 de noviembre, cierre parcial del día')).toBeInTheDocument()
    expect(sales.getByText('+14,8%')).toBeInTheDocument()
    expect(sales.getByText(/Ayer a esta hora: \$\s2\.106\.300/)).toBeInTheDocument()
    expect(
      sales.getByText(/12 ventas · 8 clientes · \$\s18\.500\.000 en el mes/),
    ).toBeInTheDocument()
    expect(branchDashboard).toHaveBeenCalledWith(makro.id, 'test-token')
  })

  it('draws the last 7 days with today highlighted', async () => {
    renderPage()

    const bars = await screen.findByRole('list', { name: 'Ventas de los últimos 7 días' })
    const labels = within(bars)
      .getAllByRole('listitem')
      .map((item) => item.textContent?.replace(/\$.*/, '').trim())
    expect(labels).toEqual(['Vie', 'Sáb', 'Dom', 'Lun', 'Mar', 'Mié', 'Hoy'])
  })

  it('shows the stock by category and the branch with its cash shift', async () => {
    renderPage()

    const stock = await panel('Stock total')
    expect(await stock.findByText('1.284')).toBeInTheDocument()
    expect(stock.getByText('unidades en Makro')).toBeInTheDocument()
    expect(stock.getByText('2 productos con menos de 5 unidades')).toBeInTheDocument()
    expect(stock.getByText('Proteína').nextElementSibling).toHaveTextContent('612')
    const branch = await panel('Sede')
    expect(branch.getByText('1 / 1')).toBeInTheDocument()
    expect(branch.getByText('Makro')).toBeInTheDocument()
  })

  it('lists the inventory alerts with the action each role can take', async () => {
    renderPage()

    const alerts = await panel('Alertas de inventario')
    expect(await alerts.findByText('Agotado en Makro y Sede Viva')).toBeInTheDocument()
    expect(alerts.getByText('Última unidad en Sede Viva')).toBeInTheDocument()
    expect(alerts.getByText('Por debajo del mínimo en Sede Viva')).toBeInTheDocument()
    expect(alerts.getByText('Vence en 45 días, lote del 27 dic 2026')).toBeInTheDocument()
    expect(alerts.getByRole('link', { name: 'Pedir: Dymatize Elite Whey 5lb' })).toHaveAttribute(
      'href',
      '/proveedores/compras',
    )
    expect(
      alerts.getByRole('link', { name: 'Trasladar: Iron Creatina Ultra Pure 500g' }),
    ).toHaveAttribute('href', '/inventario/movimientos')
    expect(alerts.queryByRole('link', { name: /Promover/ })).not.toBeInTheDocument()
    expect(alerts.getByRole('link', { name: 'Ver inventario' })).toHaveAttribute(
      'href',
      `/inventario?sede=${makro.id}`,
    )
  })

  it('ranks the best sellers of the day', async () => {
    renderPage()

    const top = await panel('Más vendidos hoy')
    expect(await top.findByText('Best Whey Vainilla 5lb')).toBeInTheDocument()
    expect(top.getAllByRole('listitem')).toHaveLength(2)
  })

  it('explains an empty day', async () => {
    branchDashboard.mockResolvedValue(
      dashboard({ topProducts: [], alerts: { total: 0, lowStockProducts: 0, items: [] } }),
    )
    renderPage()

    expect(await screen.findByText('Todavía no hay ventas completadas hoy.')).toBeInTheDocument()
    expect(screen.getByText(/Todo el inventario está en nivel/)).toBeInTheDocument()
  })

  it('gives the superadmin the global view, every action and the branch switch', async () => {
    auth.role = 'SUPERADMIN'
    listBranches.mockResolvedValue({
      data: [
        { ...makro, active: true },
        { ...viva, active: true },
      ],
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    } as never)
    const { user, url } = renderPage()

    await waitFor(() => expect(globalDashboard).toHaveBeenCalledWith('test-token'))
    const branches = await panel('Sedes')
    expect(await branches.findByText('1 / 2')).toBeInTheDocument()
    const names = branches.getAllByRole('term').map((term) => term.textContent)
    expect(names).toEqual(['Makro (abierta)', 'Sede Viva (sin turno)'])
    expect(
      (await panel('Alertas de inventario')).getByRole('link', {
        name: 'Promover: Insane Labz Psychotic Gold',
      }),
    ).toHaveAttribute('href', '/promociones')
    expect(screen.getByRole('link', { name: 'Nueva venta' })).toHaveAttribute('href', '/pos')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sede' }), viva.id)
    await waitFor(() => expect(branchDashboard).toHaveBeenCalledWith(viva.id, 'test-token'))
    expect(url()).toBe(`/dashboard?sede=${viva.id}`)
  })

  it('shows a red badge when the sales are below yesterday', async () => {
    branchDashboard.mockResolvedValue(
      dashboard({ salesToday: { count: 1, totalAmount: 50000 }, salesYesterdayUntilNow: 100000 }),
    )
    renderPage()

    expect(await screen.findByText('−50,0%')).toHaveClass('dashboard-change--down')
  })

  it('shows a loading state and then the error with a retry', async () => {
    branchDashboard.mockReset()
    branchDashboard.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(dashboard())
    const { user } = renderPage()

    expect(screen.getByRole('status', { name: 'Cargando indicadores...' })).toBeInTheDocument()
    expect(
      await screen.findByText('No fue posible cargar los indicadores. Intenta de nuevo.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('1.284')).toBeInTheDocument()
  })

  it('explains a branch scope error', async () => {
    branchDashboard.mockRejectedValue(
      new ApiError('Forbidden', 403, undefined, 'BRANCH_SCOPE_VIOLATION'),
    )
    renderPage()

    expect(await screen.findByText('No tienes acceso a esta sede.')).toBeInTheDocument()
  })

  it('locks the selector when the user has a single branch', async () => {
    auth.role = 'BRANCH_ASSISTANT'
    renderPage()

    await screen.findByText('1.284')
    expect(screen.getByRole('combobox', { name: 'Sede' })).toBeDisabled()
  })

  it('asks for a branch assignment when a branch role has none', () => {
    auth.branches = []
    renderPage()

    expect(screen.getByText('No tienes sedes asignadas')).toBeInTheDocument()
    expect(branchDashboard).not.toHaveBeenCalled()
  })
})

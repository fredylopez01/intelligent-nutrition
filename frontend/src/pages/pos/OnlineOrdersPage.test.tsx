import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { onlineOrdersService } from '../../services/onlineOrders.service'
import { buildOrder } from '../../test-utils/onlineOrders'
import type { OnlineOrder } from '../../types/onlineOrder'

import { OnlineOrdersPage } from './OnlineOrdersPage'

const auth = vi.hoisted(() => ({
  role: 'BRANCH_LEADER',
  branches: [] as { id: string; name: string }[],
}))

vi.mock('../../services/onlineOrders.service', () => ({
  onlineOrdersService: { list: vi.fn(), updateStatus: vi.fn(), complete: vi.fn() },
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
  AppLayout: ({
    title,
    subtitle,
    children,
  }: {
    title: string
    subtitle?: string
    children: ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {children}
    </main>
  ),
}))

const list = vi.mocked(onlineOrdersService.list)
const makro = { id: 'makro', name: 'Sede Makro' }

function page(orders: OnlineOrder[], openOrders = orders.length) {
  return {
    data: orders,
    meta: { page: 1, limit: 20, total: orders.length, totalPages: 1, openOrders },
  }
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.search}</p>
}

function renderPage(path = '/pos/pedidos') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <OnlineOrdersPage />
      <LocationProbe />
    </MemoryRouter>,
  )
  return { user, search: () => screen.getByTestId('location').textContent }
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.role = 'BRANCH_LEADER'
  auth.branches = [makro]
  list.mockResolvedValue(
    page([
      buildOrder(),
      buildOrder({
        id: 'order-2',
        code: 'P-20261114-0002',
        status: 'CONFIRMED',
        fulfillment: 'DELIVERY',
        delivery: { address: 'Calle 19 # 9-35', neighborhood: 'Centro' },
        customer: {
          id: 'c-1',
          name: 'Ana Gómez',
          phone: '3001234567',
          email: null,
          registered: true,
        },
      }),
    ]),
  )
})

describe('OnlineOrdersPage', () => {
  it('lists the web orders of the branch with their status', async () => {
    renderPage()

    const table = await screen.findByRole('table', { name: 'Pedidos web' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('P-20261114-0001')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Pendiente')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Domicilio')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Centro')).toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'Sede' })).not.toBeInTheDocument()
    expect(screen.getByText('2 pedidos en curso')).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 20, branchId: 'makro' }, 'test-token')
  })

  it('filters by status and fulfillment', async () => {
    const { user, search } = renderPage()

    await screen.findByRole('table')
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'PENDING')
    await user.selectOptions(screen.getByLabelText('Filtrar por tipo de entrega'), 'DELIVERY')

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        { page: 1, limit: 20, branchId: 'makro', status: 'PENDING', fulfillment: 'DELIVERY' },
        'test-token',
      ),
    )
    expect(search()).toContain('estado=PENDING')
  })

  it('opens an order, confirms it and refreshes the list', async () => {
    vi.mocked(onlineOrdersService.updateStatus).mockResolvedValue(
      buildOrder({ status: 'CONFIRMED' }),
    )
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Ver el pedido P-20261114-0001' }))
    const dialog = screen.getByRole('dialog', { name: 'Pedido P-20261114-0001' })
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar pedido' }))

    expect(
      await screen.findByText('El pedido P-20261114-0001 quedó confirmado.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('lets the superadmin see every branch', async () => {
    auth.role = 'SUPERADMIN'
    auth.branches = []
    const { branchesService } = await import('../../services/branches.service')
    vi.mocked(branchesService.list).mockResolvedValue({
      data: [{ ...makro, address: 'Calle', phone: '1', active: true }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    })
    renderPage()

    const table = await screen.findByRole('table', { name: 'Pedidos web' })
    expect(within(table).getByRole('columnheader', { name: 'Sede' })).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 20 }, 'test-token')
  })

  it('explains an empty list', async () => {
    list.mockResolvedValue(page([], 0))
    renderPage()

    expect(await screen.findByText('Todavía no hay pedidos web')).toBeInTheDocument()
    expect(screen.getByText('0 pedidos en curso')).toBeInTheDocument()
  })
})

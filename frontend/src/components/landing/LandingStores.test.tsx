import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePublicBranches } from '../../hooks/usePublicBranches'
import { branchesService } from '../../services/branches.service'
import type { Branch } from '../../types/branch'

import { LandingStores } from './LandingStores'

vi.mock('../../services/branches.service', () => ({
  branchesService: { list: vi.fn() },
}))

const list = vi.mocked(branchesService.list)

function Harness() {
  return <LandingStores {...usePublicBranches()} />
}
const lunchBreak = [
  { opensAt: '08:00', closesAt: '13:00' },
  { opensAt: '15:00', closesAt: '20:00' },
]
const weekdays = [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, intervals: lunchBreak }))
const branches: Branch[] = [
  {
    id: 'viva',
    name: 'Sede Viva',
    address: 'Av. Norte 45-10, Tunja',
    phone: '3001112233',
    active: true,
    schedule: [...weekdays, { dayOfWeek: 6, intervals: [{ opensAt: '09:00', closesAt: '14:00' }] }],
  },
  {
    id: 'sogamoso',
    name: 'Sede Sogamoso',
    address: 'Calle 11 # 14-20, Sogamoso',
    phone: '3002223344',
    active: false,
    schedule: weekdays,
  },
  {
    id: 'makro',
    name: 'Sede Makro',
    address: 'Av. Universitaria 20-30, Tunja',
    phone: '3003334455',
    active: true,
    schedule: [],
  },
]

function response(data: Branch[]) {
  return { data, meta: { page: 1, limit: 100, total: data.length, totalPages: 1 } }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T18:30:00Z'))
  list.mockResolvedValue(response(branches))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('LandingStores', () => {
  it('lists every branch from the public API with its live status', async () => {
    render(<Harness />)

    const track = await screen.findByRole('list', { name: 'Sedes de Intelligent Nutrition' })
    const cards = within(track).getAllByRole('listitem')
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Sede Makro',
      'Sede Viva',
      'Sede Sogamoso',
    ])
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 100 }, null)
    const viva = within(cards[1])
    expect(viva.getByText('Tunja')).toBeInTheDocument()
    expect(viva.getByText('Cerrada · abre hoy a las 3:00 p. m.')).toBeInTheDocument()
    expect(viva.getByText('Lun a Vie').nextElementSibling).toHaveTextContent(
      '8:00 a. m. – 1:00 p. m. y 3:00 p. m. – 8:00 p. m.',
    )
    expect(viva.getByRole('link', { name: /Cómo llegar/ })).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.google.com/maps/search/?api=1&query='),
    )
    expect(viva.getByRole('link', { name: /Llamar/ })).toHaveAttribute('href', 'tel:3001112233')
    expect(within(cards[0]).getByText('Horario por confirmar')).toBeInTheDocument()
    const sogamoso = within(cards[2])
    expect(sogamoso.getByText('Sede inactiva')).toBeInTheDocument()
    expect(sogamoso.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('2 sedes activas · 0 abiertas ahora')).toBeInTheDocument()
  })

  it('shows a branch as open inside its hours', async () => {
    vi.setSystemTime(new Date('2026-11-16T14:00:00Z'))
    render(<Harness />)

    expect(await screen.findByText('Abierta · cierra a las 1:00 p. m.')).toBeInTheDocument()
    expect(screen.getByText('2 sedes activas · 1 abierta ahora')).toBeInTheDocument()
  })

  it('lets the visitor retry when the branches cannot be loaded', async () => {
    list.mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByRole('list', { name: 'Cargando sedes' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Sede Viva')).toBeInTheDocument()
  })

  it('explains when there are no branches yet', async () => {
    list.mockResolvedValue(response([]))
    render(<Harness />)

    expect(await screen.findByText('Muy pronto anunciaremos nuestras sedes.')).toBeInTheDocument()
  })
})

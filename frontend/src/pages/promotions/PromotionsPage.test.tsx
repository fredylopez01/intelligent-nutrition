import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { promotionsService } from '../../services/promotions.service'
import { BLACK_FRIDAY, SUMMER, buildPromotion, promotionsPage } from '../../test-utils/promotions'
import type { PromotionsListParams } from '../../types/promotion'

import { PromotionsPage } from './PromotionsPage'

vi.mock('../../services/promotions.service', () => ({
  promotionsService: {
    list: vi.fn(),
    getActive: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
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

const list = vi.mocked(promotionsService.list)
const create = vi.mocked(promotionsService.create)
const update = vi.mocked(promotionsService.update)
const updateStatus = vi.mocked(promotionsService.updateStatus)

function lastListParams(): PromotionsListParams {
  const call = list.mock.lastCall
  if (!call) throw new Error('The promotions list was never requested')
  return call[0]
}

function renderPage(path = '/promociones') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <PromotionsPage />
    </MemoryRouter>,
  )
  return { user }
}

function rowOf(name: string) {
  return screen.getByRole('cell', { name: new RegExp(name) }).closest('tr') as HTMLElement
}

beforeEach(() => {
  vi.resetAllMocks()
  list.mockResolvedValue(promotionsPage([SUMMER, BLACK_FRIDAY]))
})

describe('PromotionsPage list', () => {
  it('shows the discount, period and visual state of each promotion', async () => {
    renderPage()
    await screen.findByRole('table')

    const summer = rowOf('Verano saludable')
    expect(within(summer).getByText('Activa')).toHaveClass('ui-status--activo')
    expect(summer).toHaveClass('promotions-table__row--active')
    expect(within(summer).getAllByText(/Sin fechas/)).not.toHaveLength(0)
    const blackFriday = rowOf('Black Friday')
    expect(within(blackFriday).getByText('Inactiva')).toHaveClass('ui-status--inactivo')
    expect(within(blackFriday).getAllByText(/15 %/)).not.toHaveLength(0)
    expect(within(blackFriday).getAllByText(/1 nov 2026 – 30 nov 2026/)).not.toHaveLength(0)
    expect(lastListParams()).toEqual({ page: 1, limit: 10, search: undefined, active: undefined })
  })

  it('warns when the active promotion is outside its dates', async () => {
    list.mockResolvedValue(
      promotionsPage([buildPromotion({ active: true, startDate: null, endDate: '2020-01-31' })]),
    )
    renderPage()

    expect(await screen.findByText('Fuera de su vigencia')).toBeInTheDocument()
  })

  it('searches by name and filters by state', async () => {
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.type(screen.getByRole('searchbox', { name: 'Buscar promoción por nombre' }), 'black')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(lastListParams()).toMatchObject({ search: 'black' }))
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'inactivas')

    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ page: 1, search: 'black', active: false }),
    )
  })

  it('shows the loading state while the list arrives', () => {
    list.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByText('Cargando promociones...')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the error and retries the list', async () => {
    list.mockRejectedValueOnce(new ApiError('down', 500))
    const { user } = renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('invites to register the first promotion when there are none', async () => {
    list.mockResolvedValue(promotionsPage([]))
    renderPage()

    expect(await screen.findByText('Todavía no hay promociones')).toBeInTheDocument()
  })

  it('offers to clear the filters when nothing matches', async () => {
    list.mockResolvedValue(promotionsPage([]))
    renderPage('/promociones?q=zzz&estado=activas')

    expect(
      await screen.findByText('Ninguna promoción coincide con los filtros'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument()
  })
})

describe('PromotionsPage form', () => {
  it('registers a promotion with its percentage and dates', async () => {
    create.mockResolvedValue(buildPromotion({ id: 'promo-new', name: 'Cyber Monday' }))
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Registrar promoción' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Registrar promoción' }))
    await user.type(dialog.getByLabelText('Nombre'), 'Cyber Monday')
    await user.type(dialog.getByLabelText('Descuento (%)'), '12,5')
    await user.type(dialog.getByLabelText('Desde (opcional)'), '2026-12-01')
    await user.type(dialog.getByLabelText('Hasta (opcional)'), '2026-12-02')
    await user.click(dialog.getByRole('button', { name: 'Registrar promoción' }))

    expect(create).toHaveBeenCalledWith(
      {
        name: 'Cyber Monday',
        discountPercentage: '12.50',
        startDate: '2026-12-01',
        endDate: '2026-12-02',
      },
      'test-token',
    )
    expect(await screen.findByText(/quedó registrada e inactiva/)).toBeInTheDocument()
  })

  it('validates the date range before sending', async () => {
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Registrar promoción' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Registrar promoción' }))
    await user.type(dialog.getByLabelText('Nombre'), 'Cyber Monday')
    await user.type(dialog.getByLabelText('Descuento (%)'), '10')
    await user.type(dialog.getByLabelText('Desde (opcional)'), '2026-12-10')
    await user.type(dialog.getByLabelText('Hasta (opcional)'), '2026-12-01')
    await user.click(dialog.getByRole('button', { name: 'Registrar promoción' }))

    expect(
      await dialog.findByText('La fecha final debe ser igual o posterior a la fecha inicial.'),
    ).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('shows the duplicated name under the field', async () => {
    create.mockRejectedValue(new ApiError('dup', 409, undefined, 'PROMOTION_NAME_ALREADY_EXISTS'))
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Registrar promoción' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Registrar promoción' }))
    await user.type(dialog.getByLabelText('Nombre'), 'Black Friday')
    await user.type(dialog.getByLabelText('Descuento (%)'), '10')
    await user.click(dialog.getByRole('button', { name: 'Registrar promoción' }))

    expect(
      await dialog.findByText('Ya existe una promoción con ese nombre. Usa otro.'),
    ).toBeInTheDocument()
  })

  it('edits only the changed fields of an inactive promotion', async () => {
    update.mockResolvedValue({ ...BLACK_FRIDAY, discountPercentage: '20.00' })
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Acciones para Black Friday' }))
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Editar promoción' }))
    expect(dialog.getByLabelText('Desde (opcional)')).toHaveValue('2026-11-01')
    await user.clear(dialog.getByLabelText('Descuento (%)'))
    await user.type(dialog.getByLabelText('Descuento (%)'), '20')
    await user.click(dialog.getByRole('button', { name: 'Guardar cambios' }))

    expect(update).toHaveBeenCalledWith(
      'promo-black-friday',
      { discountPercentage: '20.00' },
      'test-token',
    )
    expect(await screen.findByText('Se guardaron los cambios de Black Friday.')).toBeInTheDocument()
  })

  it('says when there are no changes to save', async () => {
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Acciones para Black Friday' }))
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Editar promoción' }))
    await user.click(dialog.getByRole('button', { name: 'Guardar cambios' }))

    expect(await dialog.findByText('No hay cambios por guardar.')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('does not offer to edit the active promotion', async () => {
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Acciones para Verano saludable' }))

    expect(screen.queryByRole('menuitem', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Desactivar' })).toBeInTheDocument()
  })
})

describe('PromotionsPage state', () => {
  it('activates a promotion warning that the current one is deactivated', async () => {
    updateStatus.mockResolvedValue({ ...BLACK_FRIDAY, active: true })
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Acciones para Black Friday' }))
    await user.click(screen.getByRole('menuitem', { name: 'Activar' }))
    const dialog = within(screen.getByRole('dialog', { name: '¿Activar esta promoción?' }))
    expect(dialog.getByText(/se desactiva automáticamente/)).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Sí, activar' }))

    expect(updateStatus).toHaveBeenCalledWith('promo-black-friday', true, 'test-token')
    expect(
      await screen.findByText(
        'Black Friday quedó activa: las ventas nuevas tienen 15 % de descuento.',
      ),
    ).toBeInTheDocument()
  })

  it('deactivates the active promotion', async () => {
    updateStatus.mockResolvedValue({ ...SUMMER, active: false })
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Acciones para Verano saludable' }))
    await user.click(screen.getByRole('menuitem', { name: 'Desactivar' }))
    await user.click(screen.getByRole('button', { name: 'Sí, desactivar' }))

    expect(updateStatus).toHaveBeenCalledWith('promo-summer', false, 'test-token')
    expect(await screen.findByText(/Verano saludable quedó inactiva/)).toBeInTheDocument()
  })

  it('explains a failed state change inside the confirmation', async () => {
    updateStatus.mockRejectedValue(new ApiError('same', 409, undefined, 'ALREADY_IN_STATE'))
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Acciones para Black Friday' }))
    await user.click(screen.getByRole('menuitem', { name: 'Activar' }))
    await user.click(screen.getByRole('button', { name: 'Sí, activar' }))

    expect(await screen.findByText(/ya tenía ese estado/)).toBeInTheDocument()
  })
})

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { branchesService } from '../../services/branches.service'
import { catalogService } from '../../services/catalog.service'
import { catalogPage, catalogProducts } from '../../test-utils/catalog'

import { PublicCatalogPage } from './PublicCatalogPage'

vi.mock('../../services/catalog.service', () => ({
  catalogService: { products: vi.fn(), categories: vi.fn(), product: vi.fn() },
}))

vi.mock('../../services/branches.service', () => ({
  branchesService: { list: vi.fn() },
}))

vi.mock('../../hooks/useBrandAssets', () => ({
  useBrandAssets: () => ({ logo: '/logo.svg', isotipo: '/isotipo.svg' }),
}))

const products = vi.mocked(catalogService.products)
const categories = vi.mocked(catalogService.categories)
const listBranches = vi.mocked(branchesService.list)

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.search}</p>
}

function renderPage(path = '/productos') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <PublicCatalogPage />
      <LocationProbe />
    </MemoryRouter>,
  )
  return { user, search: () => screen.getByTestId('location').textContent }
}

beforeEach(() => {
  vi.resetAllMocks()
  window.scrollTo = vi.fn()
  products.mockResolvedValue(catalogPage())
  categories.mockResolvedValue([
    { categoryId: 'c-protein', name: 'Proteína', productCount: 4 },
    { categoryId: 'c-creatine', name: 'Creatina', productCount: 3 },
    { categoryId: 'c-gear', name: 'Accesorios', productCount: 0 },
  ])
  listBranches.mockResolvedValue({
    data: [
      { id: 'makro', name: 'Sede Makro', address: 'Tunja', phone: '1', active: true },
      { id: 'old', name: 'Sede Vieja', address: 'Tunja', phone: '2', active: false },
    ],
    meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
  })
})

describe('PublicCatalogPage', () => {
  it('shows the available products with their availability', async () => {
    renderPage()

    const grid = await screen.findByRole('list', { name: 'Productos' })
    const cards = within(grid).getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByRole('link')).toHaveAttribute('href', '/productos/p-whey')
    expect(within(cards[0]).getByText('3 sedes')).toBeInTheDocument()
    expect(within(cards[0]).getByText(/339\.900/)).toBeInTheDocument()
    expect(within(cards[1]).getByText('Última unidad en Sede Sogamoso')).toBeInTheDocument()
    expect(screen.getByText('2 productos disponibles')).toBeInTheDocument()
    expect(products).toHaveBeenCalledWith({ page: 1, limit: 12, sort: 'name' })
  })

  it('filters by category, branch and sort through the URL', async () => {
    const { user, search } = renderPage()

    expect((await screen.findByRole('group', { name: 'Categorías' })).textContent).not.toContain(
      'Accesorios',
    )
    await user.click(screen.getByRole('button', { name: 'Creatina 3' }))
    expect(screen.getByRole('button', { name: 'Creatina 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await waitFor(() => expect(search()).toBe('?categoria=c-creatine'))

    const branch = screen.getByRole('combobox', { name: 'Sede' })
    await waitFor(() => expect(within(branch).getAllByRole('option')).toHaveLength(2))
    await user.selectOptions(branch, 'makro')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordenar' }), 'price_asc')

    await waitFor(() =>
      expect(products).toHaveBeenLastCalledWith({
        page: 1,
        limit: 12,
        categoryId: 'c-creatine',
        branchId: 'makro',
        sort: 'price_asc',
      }),
    )
    expect(await screen.findByText('2 productos disponibles en Sede Makro')).toBeInTheDocument()
  })

  it('searches by text and asks for at least two letters', async () => {
    const { user, search } = renderPage()

    const input = await screen.findByRole('searchbox', { name: 'Buscar productos' })
    await user.type(input, 'w')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(screen.getByText('Escribe al menos 2 letras.')).toBeInTheDocument()

    await user.type(input, 'hey')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(search()).toBe('?q=whey'))
  })

  it('pages through the results', async () => {
    products.mockResolvedValue(catalogPage(catalogProducts, { total: 30, totalPages: 3 }))
    const { user, search } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Siguiente' }))

    await waitFor(() => expect(search()).toBe('?pagina=2'))
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
  })

  it('offers to clear the filters when nothing matches', async () => {
    products.mockResolvedValue(catalogPage([]))
    const { user, search } = renderPage('/productos?q=xyz')

    await user.click(await screen.findByRole('button', { name: 'Limpiar filtros' }))

    await waitFor(() => expect(search()).toBe(''))
  })

  it('lets the visitor retry after an error', async () => {
    products.mockRejectedValueOnce(new Error('network'))
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('list', { name: 'Productos' })).toBeInTheDocument()
  })
})

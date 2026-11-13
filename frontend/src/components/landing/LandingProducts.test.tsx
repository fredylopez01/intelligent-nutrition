import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { catalogService } from '../../services/catalog.service'
import { catalogPage } from '../../test-utils/catalog'

import { LandingProducts } from './LandingProducts'

vi.mock('../../services/catalog.service', () => ({
  catalogService: { products: vi.fn() },
}))

const products = vi.mocked(catalogService.products)

function renderSection() {
  render(
    <MemoryRouter>
      <LandingProducts />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('LandingProducts', () => {
  it('shows the first products of the catalog and links the full catalog', async () => {
    products.mockResolvedValue(catalogPage(undefined, { total: 18 }))
    renderSection()

    const list = await screen.findByRole('list', { name: 'Productos destacados' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(products).toHaveBeenCalledWith({ page: 1, limit: 4 })
    expect(screen.getByRole('link', { name: 'Ver catálogo completo (18)' })).toHaveAttribute(
      'href',
      '/productos',
    )
  })

  it('explains an empty catalog', async () => {
    products.mockResolvedValue(catalogPage([]))
    renderSection()

    expect(await screen.findByText(/Estamos actualizando el catálogo/)).toBeInTheDocument()
  })
})

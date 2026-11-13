import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { branchesService } from '../../services/branches.service'
import { catalogService } from '../../services/catalog.service'
import { ApiError } from '../../services/http'
import { catalogProducts } from '../../test-utils/catalog'

import { PublicProductPage } from './PublicProductPage'

vi.mock('../../services/catalog.service', () => ({
  catalogService: { products: vi.fn(), categories: vi.fn(), product: vi.fn() },
}))

vi.mock('../../services/branches.service', () => ({
  branchesService: { list: vi.fn() },
}))

vi.mock('../../hooks/useBrandAssets', () => ({
  useBrandAssets: () => ({ logo: '/logo.svg', isotipo: '/isotipo.svg' }),
}))

const product = vi.mocked(catalogService.product)

function renderPage(whatsapp = '3102332100') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/productos/p-creatine']}>
      <Routes>
        <Route path="/productos/:productId" element={<PublicProductPage whatsapp={whatsapp} />} />
      </Routes>
    </MemoryRouter>,
  )
  return { user }
}

beforeEach(() => {
  vi.resetAllMocks()
  window.scrollTo = vi.fn()
  vi.mocked(branchesService.list).mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
  })
  product.mockResolvedValue({
    ...catalogProducts[1],
    description: 'Creatina monohidratada micronizada.',
    images: ['https://cdn.test/iron.webp', 'https://cdn.test/iron-2.webp'],
  })
})

describe('PublicProductPage', () => {
  it('shows the product with its stock per branch and the WhatsApp question', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Iron Creatina Ultra Pure 500g' }),
    ).toBeInTheDocument()
    expect(product).toHaveBeenCalledWith('p-creatine')
    expect(screen.getByText(/109\.990/)).toBeInTheDocument()
    const stock = within(screen.getByRole('region', { name: 'Disponibilidad por sede' }))
    expect(stock.getByText('Sede Sogamoso').nextElementSibling).toHaveTextContent('Última unidad')
    expect(stock.getByText('Bodega central').nextElementSibling).toHaveTextContent('Bajo pedido')
    const cta = screen.getByRole('link', { name: 'Preguntar por WhatsApp' })
    expect(cta.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/573102332100\?text=Hola/)
    expect(screen.getByText('Creatina monohidratada micronizada.')).toBeInTheDocument()
    expect(document.title).toBe('Iron Creatina Ultra Pure 500g | Intelligent Nutrition')
  })

  it('switches the main photo from the thumbnails and falls back when a photo fails', async () => {
    const { user } = renderPage()

    const second = await screen.findByRole('button', { name: 'Ver foto 2 de 2' })
    await user.click(second)
    expect(second).toHaveAttribute('aria-pressed', 'true')
    const main = screen.getByRole('img', { name: 'Iron Creatina Ultra Pure 500g' })
    expect(main).toHaveAttribute('src', 'https://cdn.test/iron-2.webp')

    main.dispatchEvent(new Event('error'))
    expect(await screen.findByText('Foto principal del producto')).toBeInTheDocument()
  })

  it('hides the WhatsApp button when the number is not configured', async () => {
    renderPage('')

    await screen.findByRole('heading', { name: 'Iron Creatina Ultra Pure 500g' })
    expect(screen.queryByRole('link', { name: 'Preguntar por WhatsApp' })).not.toBeInTheDocument()
  })

  it('explains when the product is no longer available', async () => {
    product.mockRejectedValue(new ApiError('Not found', 404))
    renderPage()

    expect(
      await screen.findByText('Este producto ya no está disponible en el catálogo.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute(
      'href',
      '/productos',
    )
  })
})

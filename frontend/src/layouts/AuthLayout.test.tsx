import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { branchesService } from '../services/branches.service'

import { AuthLayout } from './AuthLayout'

vi.mock('../services/branches.service', () => ({
  branchesService: { list: vi.fn() },
}))

vi.mock('../hooks/useBrandAssets', () => ({
  useBrandAssets: () => ({ logo: '/logo.svg', isotipo: '/isotipo.svg' }),
}))

const list = vi.mocked(branchesService.list)

function renderLayout(tagline?: string) {
  render(
    <MemoryRouter>
      <AuthLayout tagline={tagline}>
        <p>Formulario</p>
      </AuthLayout>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  list.mockResolvedValue({
    data: [
      { id: 'makro', name: 'Sede Makro', address: 'Tunja', phone: '1', active: true },
      { id: 'viva', name: 'Sede Viva', address: 'Tunja', phone: '2', active: true },
      { id: 'old', name: 'Sede Vieja', address: 'Tunja', phone: '3', active: false },
    ],
    meta: { page: 1, limit: 100, total: 3, totalPages: 1 },
  })
})

describe('AuthLayout', () => {
  it('describes the real active branches', async () => {
    renderLayout()

    expect(
      await screen.findByText(
        'Un solo inventario para 2 sedes. Lo que ves en pantalla es lo que hay en el estante.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Makro y Viva')).toBeInTheDocument()
  })

  it('keeps a neutral text when the branches cannot be loaded', async () => {
    list.mockRejectedValue(new Error('network'))
    renderLayout()

    expect(await screen.findByText(/Un solo inventario para todas las sedes\./)).toBeInTheDocument()
    expect(screen.queryByText(/Makro/)).not.toBeInTheDocument()
  })

  it('accepts a custom tagline', async () => {
    renderLayout('Activa tu cuenta')

    expect(screen.getByText('Activa tu cuenta')).toBeInTheDocument()
    expect(await screen.findByText('Makro y Viva')).toBeInTheDocument()
  })
})

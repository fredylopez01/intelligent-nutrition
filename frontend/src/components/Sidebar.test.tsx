import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Sidebar } from './Sidebar'

const auth = vi.hoisted(() => ({ role: 'SUPERADMIN' }))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'me', fullName: 'Persona Prueba', role: { name: auth.role } },
    logout: vi.fn(),
  }),
}))

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ preference: 'system', theme: 'light', setPreference: vi.fn() }),
}))

vi.mock('../hooks/useBrandAssets', () => ({
  useBrandAssets: () => ({ logo: 'logo.png', isotipo: 'isotipo.png' }),
}))

function menuLabels() {
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
  return within(nav)
    .getAllByRole('link')
    .filter((link) => link.classList.contains('sidebar__link'))
    .map((link) => link.textContent)
}

function renderSidebar(path = '/dashboard') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        mobileOpen={false}
        onCloseMobile={vi.fn()}
      />
    </MemoryRouter>,
  )
}

const ALWAYS = ['Dashboard', 'POS', 'Inventario', 'Catálogo']

beforeEach(() => {
  auth.role = 'SUPERADMIN'
})

describe('Sidebar menu by role', () => {
  it('shows every module to the superadmin', () => {
    renderSidebar()

    expect(menuLabels()).toEqual([
      'Dashboard',
      'POS',
      'Inventario',
      'Catálogo',
      'Promociones',
      'Proveedores',
      'Clientes',
      'Usuarios',
      'Sedes',
      'Reportes',
      'Chatbot',
    ])
  })

  it('hides branches, users and audit from the branch leader', () => {
    auth.role = 'BRANCH_LEADER'
    renderSidebar()

    const labels = menuLabels()
    expect(labels).toEqual(
      expect.arrayContaining([...ALWAYS, 'Clientes', 'Proveedores', 'Reportes']),
    )
    expect(labels).not.toContain('Sedes')
    expect(labels).not.toContain('Usuarios')
    expect(labels).not.toContain('Auditoría')
    expect(labels).not.toContain('Chatbot')
  })

  it('only shows customers among the restricted modules to the branch assistant', () => {
    auth.role = 'BRANCH_ASSISTANT'
    renderSidebar()

    const labels = menuLabels()
    expect(labels).toEqual(expect.arrayContaining([...ALWAYS, 'Clientes']))
    for (const hidden of ['Sedes', 'Proveedores', 'Usuarios', 'Auditoría', 'Reportes']) {
      expect(labels).not.toContain(hidden)
    }
  })

  it('only shows users and audit to DEV', () => {
    auth.role = 'DEV'
    renderSidebar()

    expect(menuLabels()).toEqual(['Usuarios', 'Auditoría'])
  })

  it('hides the branch modules, the dashboard, the inventory, the catalog and the POS from DEV', () => {
    auth.role = 'DEV'
    renderSidebar()

    const labels = menuLabels()
    for (const hidden of [
      'Dashboard',
      'Sedes',
      'Inventario',
      'Catálogo',
      'POS',
      'Clientes',
      'Proveedores',
      'Reportes',
    ]) {
      expect(labels).not.toContain(hidden)
    }
  })

  it.each(['BRANCH_LEADER', 'BRANCH_ASSISTANT', 'DEV'])(
    'hides the promotions from the %s',
    (role) => {
      auth.role = role
      renderSidebar()

      expect(menuLabels()).not.toContain('Promociones')
    },
  )

  it('shows the reports and the restock suggestion to the branch leader', () => {
    auth.role = 'BRANCH_LEADER'
    renderSidebar('/reportes')

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    const reports = within(nav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/reportes'))
      .map((link) => link.textContent)
    expect(reports).toEqual(['Reportes', 'Reportes', 'Reposición sugerida'])
    expect(within(nav).queryByRole('link', { name: 'Auditoría' })).not.toBeInTheDocument()
  })

  it('shows BI under the dashboard only to the superadmin', () => {
    auth.role = 'SUPERADMIN'
    renderSidebar('/reportes/dashboard')

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(nav).getByRole('link', { name: 'BI / Analítica' })).toHaveAttribute(
      'href',
      '/reportes/dashboard',
    )
    expect(within(nav).queryByRole('link', { name: 'Reposición sugerida' })).not.toBeInTheDocument()
  })

  it('places audit under reports for superadmins and keeps DEV access standalone', () => {
    renderSidebar('/reportes')

    const superadminNav = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(superadminNav).getByRole('link', { name: 'Auditoría' })).toHaveAttribute(
      'href',
      '/auditoria',
    )

    auth.role = 'DEV'
    renderSidebar('/auditoria')
    const devNav = screen.getAllByRole('navigation', { name: 'Navegación principal' }).at(-1)
    expect(devNav && within(devNav).getByRole('link', { name: 'Auditoría' })).toHaveAttribute(
      'href',
      '/auditoria',
    )
    expect(
      devNav && within(devNav).queryByRole('link', { name: 'Reportes' }),
    ).not.toBeInTheDocument()
  })

  it('does not render disabled entries for hidden modules', () => {
    auth.role = 'BRANCH_ASSISTANT'
    renderSidebar()

    expect(screen.queryByText('Sedes')).not.toBeInTheDocument()
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument()
  })
})

describe('Sidebar catalog submenu', () => {
  function catalogSubs() {
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    return within(nav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/catalogo'))
      .map((link) => link.textContent)
  }

  it('shows products, categories, units and recipes inside the catalog', () => {
    renderSidebar('/catalogo/categorias')

    expect(catalogSubs()).toEqual([
      'Catálogo',
      'Productos',
      'Categorías',
      'Unidades de medida',
      'Recetas',
    ])
  })

  it.each(['BRANCH_LEADER', 'BRANCH_ASSISTANT'])('shows the catalog submenu to the %s', (role) => {
    auth.role = role
    renderSidebar('/catalogo')

    expect(catalogSubs()).toEqual([
      'Catálogo',
      'Productos',
      'Categorías',
      'Unidades de medida',
      'Recetas',
    ])
  })

  it('hides the whole catalog from DEV, as the contract does not include it', () => {
    auth.role = 'DEV'
    renderSidebar('/dashboard')

    expect(catalogSubs()).toEqual([])
  })
})

describe('Sidebar inventory submenu', () => {
  function inventorySubs() {
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    return within(nav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/inventario'))
      .map((link) => link.textContent)
  }

  it('shows the consolidated inventory only to the superadmin', () => {
    renderSidebar('/inventario')

    expect(inventorySubs()).toEqual([
      'Inventario',
      'Existencias',
      'Consolidado',
      'Movimientos',
      'Cierre diario',
      'Insumos',
    ])
  })

  it.each(['BRANCH_LEADER', 'BRANCH_ASSISTANT'])(
    'hides the consolidated inventory from the %s',
    (role) => {
      auth.role = role
      renderSidebar('/inventario')

      expect(inventorySubs()).not.toContain('Consolidado')
      expect(inventorySubs()).toContain('Existencias')
    },
  )

  it('keeps only the brand and the navigation, without the data scope', () => {
    renderSidebar()

    expect(screen.queryByText('Alcance de datos')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Intelligent Nutrition' })).toBeInTheDocument()
  })

  it('keeps the POS submenu open and highlights Caja on its route', () => {
    renderSidebar('/caja/turno')

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    const caja = within(nav).getByRole('link', { name: 'Caja' })
    expect(caja).toHaveAttribute('href', '/caja/turno')
    expect(caja).toHaveClass('sidebar__sub--active')
    expect(within(nav).getByRole('link', { name: 'Métodos de pago' })).toBeInTheDocument()
  })
})

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../services/http'
import { productsService } from '../../services/products.service'
import { recipesService } from '../../services/recipes.service'
import { suppliesService } from '../../services/supplies.service'
import { unitsService } from '../../services/units.service'
import {
  GRAMS,
  MILK,
  MILLILITERS,
  WHEY,
  buildRecipe,
  buildRecipeSummary,
  page,
} from '../../test-utils/recipes'

import { RecipesPage } from './RecipesPage'

const auth = vi.hoisted(() => ({ role: 'SUPERADMIN' }))

vi.mock('../../services/recipes.service', () => ({
  recipesService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
  },
}))

vi.mock('../../services/supplies.service', () => ({
  suppliesService: { list: vi.fn() },
}))

vi.mock('../../services/products.service', () => ({
  productsService: { list: vi.fn() },
}))

vi.mock('../../services/units.service', () => ({
  unitsService: { list: vi.fn() },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'me', role: { name: auth.role } } }),
}))

vi.mock('../../layouts/AppLayout', () => ({
  AppLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

const listRecipes = vi.mocked(recipesService.list)
const getRecipe = vi.mocked(recipesService.get)
const createRecipe = vi.mocked(recipesService.create)
const updateRecipe = vi.mocked(recipesService.update)
const updateStatus = vi.mocked(recipesService.updateStatus)

const SHAKE = buildRecipeSummary()
const OATS = buildRecipeSummary({
  id: 'recipe-oats',
  name: 'Avena energética',
  description: null,
  active: false,
  ingredientsCount: 1,
})

function renderPage(path = '/catalogo/recetas') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <RecipesPage />
    </MemoryRouter>,
  )
  return { user }
}

function rowOf(name: string) {
  return within(screen.getByRole('button', { name }).closest('tr') as HTMLElement)
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.role = 'SUPERADMIN'
  listRecipes.mockResolvedValue(page([SHAKE, OATS]))
  getRecipe.mockResolvedValue(buildRecipe())
  vi.mocked(suppliesService.list).mockResolvedValue(page([WHEY, MILK]))
  vi.mocked(unitsService.list).mockResolvedValue(
    page([
      { ...GRAMS, name: 'Gramo', active: true },
      { ...MILLILITERS, name: 'Mililitro', active: true },
    ]),
  )
})

describe('RecipesPage list', () => {
  it('shows the recipes with their ingredients and state', async () => {
    renderPage()

    expect(await screen.findByRole('button', { name: 'Batido de proteína' })).toBeInTheDocument()
    expect(rowOf('Batido de proteína').getByText('Con leche fría')).toBeInTheDocument()
    expect(rowOf('Batido de proteína').getAllByText('2 ingredientes')).toHaveLength(2)
    expect(rowOf('Batido de proteína').getByText('Activa')).toBeInTheDocument()
    expect(rowOf('Avena energética').getAllByText('1 ingrediente')).toHaveLength(2)
    expect(rowOf('Avena energética').getByText('Inactiva')).toBeInTheDocument()
    expect(listRecipes).toHaveBeenCalledWith(
      { page: 1, limit: 10, search: undefined, active: undefined },
      'test-token',
    )
  })

  it('filters by state and searches by name', async () => {
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'activas')
    await waitFor(() =>
      expect(listRecipes).toHaveBeenLastCalledWith(
        expect.objectContaining({ active: true }),
        'test-token',
      ),
    )
    await user.type(screen.getByLabelText('Buscar receta por nombre'), 'bat{Enter}')
    await waitFor(() =>
      expect(listRecipes).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'bat' }),
        'test-token',
      ),
    )
  })

  it('asks for two letters before searching, as the server does', async () => {
    const { user } = renderPage()
    await screen.findByRole('table')
    const calls = listRecipes.mock.calls.length

    await user.type(screen.getByLabelText('Buscar receta por nombre'), 'b{Enter}')

    expect(screen.getByText('Escribe al menos 2 caracteres para buscar.')).toBeInTheDocument()
    expect(listRecipes).toHaveBeenCalledTimes(calls)
  })

  it('shows a loading state and then the error with a retry', async () => {
    listRecipes.mockReset()
    listRecipes.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(page([SHAKE]))
    const { user } = renderPage()

    expect(screen.getByText('Cargando recetas...')).toBeInTheDocument()
    expect(
      await screen.findByText('No fue posible cargar las recetas. Intenta de nuevo.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('button', { name: 'Batido de proteína' })).toBeInTheDocument()
  })

  it('invites the leader to register the first recipe', async () => {
    auth.role = 'BRANCH_LEADER'
    listRecipes.mockResolvedValue(page([]))
    renderPage()

    expect(await screen.findByText('Todavía no hay recetas')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Registrar receta' })).toHaveLength(2)
  })

  it('lets the assistant only read the recipes', async () => {
    auth.role = 'BRANCH_ASSISTANT'
    const { user } = renderPage()
    await screen.findByRole('table')

    expect(screen.queryByRole('button', { name: 'Registrar receta' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Acciones para Batido de proteína' }))
    expect(screen.getByRole('menuitem', { name: 'Ver receta' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Desactivar' })).not.toBeInTheDocument()
  })

  it('does not offer the state change to the leader', async () => {
    auth.role = 'BRANCH_LEADER'
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Acciones para Batido de proteína' }))
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Desactivar' })).not.toBeInTheDocument()
  })
})

describe('RecipesPage detail', () => {
  it('shows the ingredients of the recipe', async () => {
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Batido de proteína' }))

    const dialog = within(await screen.findByRole('dialog', { name: 'Batido de proteína' }))
    expect(await dialog.findByText('Leche entera')).toBeInTheDocument()
    expect(dialog.getByText('200 ml')).toBeInTheDocument()
    expect(dialog.getByText('30 g')).toBeInTheDocument()
    expect(getRecipe).toHaveBeenCalledWith('recipe-shake', 'test-token')
  })

  it('explains when the recipe cannot be loaded', async () => {
    getRecipe.mockRejectedValue(new ApiError('Not found', 404, undefined, 'NOT_FOUND'))
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Batido de proteína' }))

    expect(await screen.findByText('La receta ya no existe. Recarga la lista.')).toBeInTheDocument()
  })
})

describe('RecipesPage form', () => {
  async function openCreate() {
    const result = renderPage()
    await screen.findByRole('table')
    await result.user.click(screen.getByRole('button', { name: 'Registrar receta' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Registrar receta' }))
    await waitFor(() => expect(dialog.getByLabelText('Insumo')).toBeEnabled())
    return { ...result, dialog }
  }

  it('creates a recipe with several supplies and fills the unit of each supply', async () => {
    createRecipe.mockResolvedValue(buildRecipe({ name: 'Batido verde' }))
    const { user, dialog } = await openCreate()

    await user.type(dialog.getByLabelText('Nombre'), 'Batido verde')
    await user.selectOptions(dialog.getByLabelText('Insumo'), WHEY.id)
    expect(dialog.getByLabelText('Unidad')).toHaveValue(GRAMS.id)
    await user.type(dialog.getByLabelText('Cantidad'), '30,5')
    await user.click(dialog.getByRole('button', { name: 'Agregar ingrediente' }))
    await user.selectOptions(dialog.getAllByLabelText('Insumo')[1], MILK.id)
    await user.type(dialog.getAllByLabelText('Cantidad')[1], '200')
    await user.click(dialog.getByRole('button', { name: 'Registrar receta' }))

    await waitFor(() =>
      expect(createRecipe).toHaveBeenCalledWith(
        {
          name: 'Batido verde',
          ingredients: [
            { supplyId: WHEY.id, quantity: 30.5, unitOfMeasureId: GRAMS.id },
            { supplyId: MILK.id, quantity: 200, unitOfMeasureId: MILLILITERS.id },
          ],
        },
        'test-token',
      ),
    )
    expect(
      await screen.findByText('La receta Batido verde quedó registrada con 2 ingredientes.'),
    ).toBeInTheDocument()
  })

  it('requires the supply, a valid quantity and no repeated supplies', async () => {
    const { user, dialog } = await openCreate()

    await user.type(dialog.getByLabelText('Nombre'), 'Batido')
    await user.click(dialog.getByRole('button', { name: 'Registrar receta' }))
    expect(await dialog.findByText('Elige el insumo.')).toBeInTheDocument()
    expect(dialog.getByText('Escribe la cantidad.')).toBeInTheDocument()

    await user.selectOptions(dialog.getByLabelText('Insumo'), WHEY.id)
    await user.type(dialog.getByLabelText('Cantidad'), '0')
    await user.click(dialog.getByRole('button', { name: 'Agregar ingrediente' }))
    await user.selectOptions(dialog.getAllByLabelText('Insumo')[1], WHEY.id)
    await user.type(dialog.getAllByLabelText('Cantidad')[1], '10')
    await user.click(dialog.getByRole('button', { name: 'Registrar receta' }))

    expect(
      await dialog.findByText('Usa un número mayor que 0 con máximo 3 decimales.'),
    ).toBeInTheDocument()
    expect(dialog.getByText('Este insumo ya está en la receta.')).toBeInTheDocument()
    expect(createRecipe).not.toHaveBeenCalled()
  })

  it('keeps at least one ingredient line', async () => {
    const { dialog } = await openCreate()

    expect(dialog.getByRole('button', { name: 'Quitar el ingrediente 1' })).toBeDisabled()
  })

  it('shows the duplicated name error of the server', async () => {
    createRecipe.mockRejectedValue(
      new ApiError('Conflict', 409, undefined, 'RECIPE_NAME_ALREADY_EXISTS'),
    )
    const { user, dialog } = await openCreate()

    await user.type(dialog.getByLabelText('Nombre'), 'Batido de proteína')
    await user.selectOptions(dialog.getByLabelText('Insumo'), WHEY.id)
    await user.type(dialog.getByLabelText('Cantidad'), '30')
    await user.click(dialog.getByRole('button', { name: 'Registrar receta' }))

    expect(await dialog.findByText('Ya existe una receta con ese nombre.')).toBeInTheDocument()
  })

  it('warns when there are no active supplies', async () => {
    vi.mocked(suppliesService.list).mockResolvedValue(page([]))
    const { dialog } = await openCreate()

    expect(dialog.getByText(/No hay insumos activos/)).toBeInTheDocument()
  })

  it('links the new recipe to the catalog product sold in the POS', async () => {
    vi.mocked(productsService.list).mockResolvedValue({
      data: [
        {
          id: 'product-shake',
          name: 'Batido de proteína 16 oz',
          referenceCode: 'BAT-16',
          category: { id: 'cat-drinks', name: 'Bebidas' },
        },
      ],
      meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
    } as never)
    createRecipe.mockResolvedValue(buildRecipe({ name: 'Batido verde' }))
    const { user, dialog } = await openCreate()

    await user.type(dialog.getByLabelText('Nombre'), 'Batido verde')
    await user.selectOptions(dialog.getByLabelText('Insumo'), WHEY.id)
    await user.type(dialog.getByLabelText('Cantidad'), '30')
    await user.click(dialog.getByLabelText(/Se vende en el POS/))
    await user.click(dialog.getByRole('button', { name: 'Registrar receta' }))
    expect(
      await dialog.findByText('Elige el producto del catálogo que se vende con esta receta.'),
    ).toBeInTheDocument()
    expect(createRecipe).not.toHaveBeenCalled()

    await user.click(await dialog.findByRole('button', { name: /Batido de proteína 16 oz/ }))
    await user.click(dialog.getByRole('button', { name: 'Registrar receta' }))

    await waitFor(() =>
      expect(createRecipe).toHaveBeenCalledWith(
        {
          name: 'Batido verde',
          ingredients: [{ supplyId: WHEY.id, quantity: 30, unitOfMeasureId: GRAMS.id }],
          productId: 'product-shake',
        },
        'test-token',
      ),
    )
  })

  it('removes the product of a recipe that was sold in the POS', async () => {
    getRecipe.mockResolvedValue(
      buildRecipe({
        product: {
          id: 'product-shake',
          name: 'Batido de proteína 16 oz',
          referenceCode: 'BAT-16',
          price: '12000.00',
        },
      }),
    )
    updateRecipe.mockResolvedValue(buildRecipe())
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Acciones para Batido de proteína' }))
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Editar Batido de proteína' }))
    await dialog.findAllByLabelText('Cantidad')
    expect(dialog.getByText('Batido de proteína 16 oz')).toBeInTheDocument()
    await user.click(dialog.getByLabelText(/Se vende en el POS/))
    await user.click(dialog.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(updateRecipe).toHaveBeenCalledWith('recipe-shake', { productId: null }, 'test-token'),
    )
  })

  it('edits only the ingredients that changed', async () => {
    updateRecipe.mockResolvedValue(buildRecipe())
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Acciones para Batido de proteína' }))
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Editar Batido de proteína' }))
    const quantities = await dialog.findAllByLabelText('Cantidad')
    expect(quantities[0]).toHaveValue('200')
    await user.clear(quantities[1])
    await user.type(quantities[1], '35')
    await user.click(dialog.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(updateRecipe).toHaveBeenCalledWith(
        'recipe-shake',
        {
          ingredients: [
            { supplyId: MILK.id, quantity: 200, unitOfMeasureId: MILLILITERS.id },
            { supplyId: WHEY.id, quantity: 35, unitOfMeasureId: GRAMS.id },
          ],
        },
        'test-token',
      ),
    )
    expect(
      await screen.findByText('Se guardaron los cambios de Batido de proteína.'),
    ).toBeInTheDocument()
  })

  it('opens the editor from the detail', async () => {
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Batido de proteína' }))
    await user.click(await screen.findByRole('button', { name: 'Editar receta' }))

    expect(
      await screen.findByRole('dialog', { name: 'Editar Batido de proteína' }),
    ).toBeInTheDocument()
  })
})

describe('RecipesPage state', () => {
  it('deactivates a recipe after confirming', async () => {
    updateStatus.mockResolvedValue({ message: 'ok' })
    const { user } = renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Acciones para Batido de proteína' }))
    await user.click(screen.getByRole('menuitem', { name: 'Desactivar' }))
    await user.click(screen.getByRole('button', { name: 'Sí, desactivar' }))

    expect(updateStatus).toHaveBeenCalledWith('recipe-shake', false, 'test-token')
    expect(await screen.findByText(/Batido de proteína quedó inactiva/)).toBeInTheDocument()
  })
})

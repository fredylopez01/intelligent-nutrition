import type { Recipe, RecipeSummary } from '../types/recipe'
import type { Supply } from '../types/supply'

export const GRAMS = { id: 'unit-g', abbreviation: 'g' }
export const MILLILITERS = { id: 'unit-ml', abbreviation: 'ml' }

export function buildSupply(overrides: Partial<Supply> = {}): Supply {
  return {
    id: 'supply-whey',
    name: 'Proteína en polvo',
    unitOfMeasure: { id: GRAMS.id, name: 'Gramo', abbreviation: 'g' },
    active: true,
    createdAt: '2026-11-06T15:30:00.000Z',
    ...overrides,
  }
}

export const WHEY = buildSupply()
export const MILK = buildSupply({
  id: 'supply-milk',
  name: 'Leche entera',
  unitOfMeasure: { id: MILLILITERS.id, name: 'Mililitro', abbreviation: 'ml' },
})

export function buildRecipeSummary(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id: 'recipe-shake',
    name: 'Batido de proteína',
    description: 'Con leche fría',
    active: true,
    ingredientsCount: 2,
    createdAt: '2026-11-06T15:30:00.000Z',
    ...overrides,
  }
}

export function buildRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-shake',
    name: 'Batido de proteína',
    description: 'Con leche fría',
    active: true,
    ingredients: [
      {
        id: 'ingredient-milk',
        supply: { id: MILK.id, name: MILK.name, unitOfMeasure: MILLILITERS },
        quantity: '200.000',
        unitOfMeasure: MILLILITERS,
      },
      {
        id: 'ingredient-whey',
        supply: { id: WHEY.id, name: WHEY.name, unitOfMeasure: GRAMS },
        quantity: '30.000',
        unitOfMeasure: GRAMS,
      },
    ],
    createdAt: '2026-11-06T15:30:00.000Z',
    updatedAt: '2026-11-06T15:30:00.000Z',
    ...overrides,
  }
}

export function page<T>(data: T[]) {
  return {
    data,
    meta: { page: 1, limit: 10, total: data.length, totalPages: data.length ? 1 : 0 },
  }
}

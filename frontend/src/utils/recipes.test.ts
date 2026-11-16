import { describe, expect, it } from 'vitest'

import { ApiError } from '../services/http'
import { buildRecipe, GRAMS, MILK, MILLILITERS, WHEY } from '../test-utils/recipes'

import {
  buildRecipeChanges,
  formatIngredientQuantity,
  parseIngredientQuantity,
  recipeFormValues,
  recipeSchema,
  resolveRecipeError,
} from './recipes'

describe('recipe utils', () => {
  it('parses quantities with up to three decimals and a comma or a dot', () => {
    expect(parseIngredientQuantity('30')).toBe(30)
    expect(parseIngredientQuantity('0,125')).toBe(0.125)
    expect(parseIngredientQuantity('1.5')).toBe(1.5)
    expect(parseIngredientQuantity('0')).toBeNull()
    expect(parseIngredientQuantity('1.2345')).toBeNull()
    expect(parseIngredientQuantity('abc')).toBeNull()
  })

  it('formats a quantity with its unit', () => {
    expect(formatIngredientQuantity('200.000', 'ml')).toBe('200 ml')
    expect(formatIngredientQuantity('0.125', 'kg')).toBe('0,125 kg')
  })

  it('requires at least one ingredient and rejects repeated supplies', () => {
    expect(
      recipeSchema.safeParse({ name: 'Batido', description: '', ingredients: [] }).success,
    ).toBe(false)
    const repeated = recipeSchema.safeParse({
      name: 'Batido',
      description: '',
      ingredients: [
        { supplyId: WHEY.id, quantity: '30', unitOfMeasureId: GRAMS.id },
        { supplyId: WHEY.id, quantity: '10', unitOfMeasureId: GRAMS.id },
      ],
    })
    expect(repeated.success).toBe(false)
  })

  it('sends only the fields that changed, and the whole ingredient list when one changes', () => {
    const recipe = buildRecipe()
    const values = recipeFormValues(recipe)

    expect(buildRecipeChanges(values, recipe)).toEqual({})
    expect(buildRecipeChanges({ ...values, description: '' }, recipe)).toEqual({
      description: null,
    })
    expect(
      buildRecipeChanges(
        {
          ...values,
          ingredients: [{ ...values.ingredients[0], quantity: '250' }, values.ingredients[1]],
        },
        recipe,
      ),
    ).toEqual({
      ingredients: [
        { supplyId: MILK.id, quantity: 250, unitOfMeasureId: MILLILITERS.id },
        { supplyId: WHEY.id, quantity: 30, unitOfMeasureId: GRAMS.id },
      ],
    })
  })

  it('explains the errors of the server', () => {
    expect(resolveRecipeError(new ApiError('x', 422, undefined, 'SUPPLY_INACTIVE'), 'f')).toBe(
      'Uno de los insumos está inactivo. Quítalo o elige otro.',
    )
    expect(resolveRecipeError(new ApiError('x', 403), 'f')).toBe(
      'Tu rol no puede hacer este cambio en las recetas.',
    )
    expect(resolveRecipeError(new Error('x'), 'f')).toBe('f')
  })
})

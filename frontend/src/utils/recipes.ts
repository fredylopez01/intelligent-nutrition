import { z } from 'zod'

import { ApiError } from '../services/http'
import type { RoleName } from '../types/auth'
import type { Recipe, RecipeIngredientPayload, UpdateRecipePayload } from '../types/recipe'

export const RECIPE_MANAGE_ROLES: RoleName[] = ['SUPERADMIN', 'BRANCH_LEADER']
export const RECIPE_STATUS_ROLES: RoleName[] = ['SUPERADMIN']
export const RECIPE_NAME_MIN_LENGTH = 2
export const RECIPE_NAME_MAX_LENGTH = 150
export const RECIPE_DESCRIPTION_MAX_LENGTH = 500

const QUANTITY_PATTERN = /^\d{1,9}([.,]\d{1,3})?$/

export function parseIngredientQuantity(text: string): number | null {
  const value = text.trim()
  if (!QUANTITY_PATTERN.test(value)) return null
  const quantity = Number(value.replace(',', '.'))
  return quantity > 0 ? quantity : null
}

const quantityFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 })

export function formatIngredientQuantity(quantity: string | number, unit: string): string {
  const value = typeof quantity === 'number' ? quantity : Number(quantity)
  if (!Number.isFinite(value)) return `${quantity} ${unit}`.trim()
  return `${quantityFormatter.format(value)} ${unit}`.trim()
}

const ingredientSchema = z.object({
  supplyId: z.string().min(1, 'Elige el insumo.'),
  quantity: z
    .string()
    .trim()
    .min(1, 'Escribe la cantidad.')
    .refine(
      (value) => parseIngredientQuantity(value) !== null,
      'Usa un número mayor que 0 con máximo 3 decimales.',
    ),
  unitOfMeasureId: z.string().min(1, 'Elige la unidad.'),
})

export const recipeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(
        RECIPE_NAME_MIN_LENGTH,
        `El nombre debe tener al menos ${RECIPE_NAME_MIN_LENGTH} caracteres.`,
      )
      .max(
        RECIPE_NAME_MAX_LENGTH,
        `El nombre no puede superar los ${RECIPE_NAME_MAX_LENGTH} caracteres.`,
      ),
    description: z
      .string()
      .trim()
      .max(
        RECIPE_DESCRIPTION_MAX_LENGTH,
        `La descripción no puede superar los ${RECIPE_DESCRIPTION_MAX_LENGTH} caracteres.`,
      ),
    ingredients: z.array(ingredientSchema).min(1, 'Agrega al menos un ingrediente.'),
  })
  .superRefine((values, context) => {
    const seen = new Set<string>()
    values.ingredients.forEach((ingredient, index) => {
      if (!ingredient.supplyId) return
      if (seen.has(ingredient.supplyId)) {
        context.addIssue({
          code: 'custom',
          path: ['ingredients', index, 'supplyId'],
          message: 'Este insumo ya está en la receta.',
        })
      }
      seen.add(ingredient.supplyId)
    })
  })

export type RecipeFormValues = z.infer<typeof recipeSchema>

export function recipeFormValues(recipe?: Recipe): RecipeFormValues {
  return {
    name: recipe?.name ?? '',
    description: recipe?.description ?? '',
    ingredients:
      recipe?.ingredients.map((ingredient) => ({
        supplyId: ingredient.supply.id,
        quantity: String(Number(ingredient.quantity)),
        unitOfMeasureId: ingredient.unitOfMeasure.id,
      })) ?? [],
  }
}

export function toIngredientPayloads(
  ingredients: RecipeFormValues['ingredients'],
): RecipeIngredientPayload[] {
  return ingredients.map((ingredient) => ({
    supplyId: ingredient.supplyId,
    quantity: parseIngredientQuantity(ingredient.quantity) ?? 0,
    unitOfMeasureId: ingredient.unitOfMeasureId,
  }))
}

function sameIngredients(a: RecipeIngredientPayload[], b: RecipeIngredientPayload[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (ingredient, index) =>
      ingredient.supplyId === b[index].supplyId &&
      ingredient.quantity === b[index].quantity &&
      ingredient.unitOfMeasureId === b[index].unitOfMeasureId,
  )
}

export function buildRecipeChanges(values: RecipeFormValues, recipe: Recipe): UpdateRecipePayload {
  const original = recipeFormValues(recipe)
  const changes: UpdateRecipePayload = {}
  const name = values.name.trim()
  const description = values.description.trim()
  if (name !== original.name) changes.name = name
  if (description !== original.description.trim()) changes.description = description || null
  const ingredients = toIngredientPayloads(values.ingredients)
  if (!sameIngredients(ingredients, toIngredientPayloads(original.ingredients))) {
    changes.ingredients = ingredients
  }
  return changes
}

export function ingredientsLabel(count: number): string {
  return count === 1 ? '1 ingrediente' : `${count} ingredientes`
}

export function resolveRecipeError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case 'RECIPE_NAME_ALREADY_EXISTS':
      return 'Ya existe una receta con ese nombre.'
    case 'DUPLICATED_SUPPLY':
      return 'Un insumo solo puede aparecer una vez en la receta.'
    case 'SUPPLY_INACTIVE':
      return 'Uno de los insumos está inactivo. Quítalo o elige otro.'
    case 'SUPPLY_NOT_FOUND':
      return 'Uno de los insumos ya no existe. Quítalo o elige otro.'
    case 'UNIT_INACTIVE':
      return 'Una de las unidades de medida está inactiva. Elige otra.'
    case 'UNIT_NOT_FOUND':
      return 'Una de las unidades de medida ya no existe. Elige otra.'
    case 'ALREADY_IN_STATE':
      return 'La receta ya estaba en ese estado. Recarga la lista.'
    case 'NOT_FOUND':
      return 'La receta ya no existe. Recarga la lista.'
  }
  if (error.status === 403) return 'Tu rol no puede hacer este cambio en las recetas.'
  if (error.status === 400) return 'Revisa los datos: hay un valor que el servidor no aceptó.'
  return fallback
}

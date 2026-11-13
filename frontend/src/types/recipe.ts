import type { PaginationMeta } from './user'

export interface RecipeUnit {
  id: string
  abbreviation: string
}

export interface RecipeIngredient {
  id: string
  supply: {
    id: string
    name: string
    unitOfMeasure: RecipeUnit
  }
  quantity: string
  unitOfMeasure: RecipeUnit
}

export interface RecipeSummary {
  id: string
  name: string
  description: string | null
  active: boolean
  ingredientsCount: number
  createdAt: string
}

export interface Recipe {
  id: string
  name: string
  description: string | null
  active: boolean
  ingredients: RecipeIngredient[]
  createdAt: string
  updatedAt: string
}

export interface RecipesListParams {
  page?: number
  limit?: number
  search?: string
  active?: boolean
}

export interface RecipesListResponse {
  data: RecipeSummary[]
  meta: PaginationMeta
}

export interface RecipeIngredientPayload {
  supplyId: string
  quantity: number
  unitOfMeasureId: string
}

export interface CreateRecipePayload {
  name: string
  description?: string | null
  ingredients: RecipeIngredientPayload[]
}

export type UpdateRecipePayload = Partial<CreateRecipePayload>

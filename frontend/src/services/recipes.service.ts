import type {
  CreateRecipePayload,
  Recipe,
  RecipesListParams,
  RecipesListResponse,
  UpdateRecipePayload,
} from '../types/recipe'

import { http } from './http'
import { buildQuery } from './supplies.service'

const RECIPES_PATH = '/recipes'

export const recipesService = {
  list: (params: RecipesListParams, token: string | null) =>
    http.get<RecipesListResponse>(`${RECIPES_PATH}${buildQuery(params)}`, { token }),

  get: (recipeId: string, token: string | null) =>
    http.get<Recipe>(`${RECIPES_PATH}/${recipeId}`, { token }),

  create: (payload: CreateRecipePayload, token: string | null) =>
    http.post<Recipe>(RECIPES_PATH, payload, { token }),

  update: (recipeId: string, payload: UpdateRecipePayload, token: string | null) =>
    http.patch<Recipe>(`${RECIPES_PATH}/${recipeId}`, payload, { token }),

  updateStatus: (recipeId: string, active: boolean, token: string | null) =>
    http.patch<{ message: string }>(`${RECIPES_PATH}/${recipeId}/status`, { active }, { token }),
}

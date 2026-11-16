import { useEffect, useState } from 'react'

import { recipesService } from '../services/recipes.service'
import type { RecipeSummary, RecipesListParams } from '../types/recipe'
import type { PaginationMeta } from '../types/user'
import { resolveRecipeError } from '../utils/recipes'

import { useAuth } from './useAuth'

interface RecipesResult {
  key: string
  status: 'success' | 'error'
  recipes: RecipeSummary[]
  meta: PaginationMeta | null
  error: string | null
}

export function useRecipes({ page, limit, search, active }: RecipesListParams) {
  const { token } = useAuth()
  const [result, setResult] = useState<RecipesResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = [
    page ?? 1,
    limit ?? 10,
    search ?? '',
    active ?? 'todos',
    token ?? '',
    reloadToken,
  ].join('|')

  useEffect(() => {
    let cancelled = false
    recipesService
      .list({ page, limit, search: search || undefined, active }, token)
      .then((response) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'success',
          recipes: response.data,
          meta: response.meta,
          error: null,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'error',
          recipes: [],
          meta: null,
          error: resolveRecipeError(err, 'No fue posible cargar las recetas. Intenta de nuevo.'),
        })
      })
    return () => {
      cancelled = true
    }
  }, [requestKey, page, limit, search, active, token])

  const current = result?.key === requestKey ? result : null
  return {
    status: current?.status ?? ('loading' as const),
    recipes: current?.recipes ?? [],
    meta: current?.meta ?? null,
    error: current?.error ?? null,
    refetch: () => setReloadToken((value) => value + 1),
  }
}

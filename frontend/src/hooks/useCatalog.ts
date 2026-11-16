import { useCallback, useEffect, useState } from 'react'

import { catalogService } from '../services/catalog.service'
import { ApiError } from '../services/http'
import type {
  CatalogCategory,
  CatalogListParams,
  CatalogListResponse,
  CatalogProductDetail,
} from '../types/catalog'

const loadCategories = () => catalogService.categories()

type Status = 'loading' | 'success' | 'error' | 'not-found'

interface Result<T> {
  key: string
  status: Exclude<Status, 'loading'>
  data: T | null
}

function useRequest<T>(key: string | null, load: () => Promise<T>) {
  const [result, setResult] = useState<Result<T> | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = key === null ? null : `${key}|${reloadToken}`

  useEffect(() => {
    if (requestKey === null) return
    let cancelled = false
    load()
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, status: 'success', data })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const notFound = error instanceof ApiError && error.status === 404
        setResult({ key: requestKey, status: notFound ? 'not-found' : 'error', data: null })
      })
    return () => {
      cancelled = true
    }
  }, [requestKey, load])

  const current = result?.key === requestKey ? result : null
  const reload = useCallback(() => setReloadToken((value) => value + 1), [])
  return { status: (current?.status ?? 'loading') as Status, data: current?.data ?? null, reload }
}

export function useCatalogProducts(params: CatalogListParams) {
  const key = JSON.stringify(params)
  const load = useCallback(
    () => catalogService.products(JSON.parse(key) as CatalogListParams),
    [key],
  )
  const { status, data, reload } = useRequest<CatalogListResponse>(key, load)
  return { status, products: data?.data ?? [], meta: data?.meta ?? null, reload }
}

export function useCatalogCategories() {
  const { status, data } = useRequest<CatalogCategory[]>('categories', loadCategories)
  return { status, categories: data ?? [] }
}

export function useCatalogProduct(productId: string | undefined) {
  const load = useCallback(() => catalogService.product(productId ?? ''), [productId])
  const { status, data, reload } = useRequest<CatalogProductDetail>(productId ?? null, load)
  return { status: productId ? status : 'not-found', product: data, reload }
}

import { useEffect, useState } from 'react'

import { suppliesService } from '../services/supplies.service'
import type { SupplyStockParams, SupplyStockRow } from '../types/supply'
import type { PaginationMeta } from '../types/user'
import { resolveSupplyError } from '../utils/supplies'

import { useAuth } from './useAuth'

interface SupplyStockResult {
  key: string
  status: 'success' | 'error'
  rows: SupplyStockRow[]
  meta: PaginationMeta | null
  error: string | null
}

export function useSupplyStock(params: SupplyStockParams, enabled = true) {
  const { token } = useAuth()
  const [result, setResult] = useState<SupplyStockResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const { page, limit, branchId, search, lowStock } = params
  const requestKey = [
    page ?? 1,
    limit ?? 20,
    branchId ?? '',
    search ?? '',
    lowStock ? 'bajo' : '',
    token ?? '',
    reloadToken,
  ].join('|')

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    suppliesService
      .stock(
        { page, limit, branchId, search: search || undefined, lowStock: lowStock || undefined },
        token,
      )
      .then((response) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'success',
          rows: response.data,
          meta: response.meta,
          error: null,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'error',
          rows: [],
          meta: null,
          error: resolveSupplyError(err, 'No fue posible cargar los insumos. Intenta de nuevo.'),
        })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, requestKey, page, limit, branchId, search, lowStock, token])

  const current = result?.key === requestKey ? result : null
  const status: 'idle' | 'loading' | 'success' | 'error' = !enabled
    ? 'idle'
    : (current?.status ?? 'loading')
  return {
    status,
    rows: current?.rows ?? [],
    meta: current?.meta ?? null,
    error: current?.error ?? null,
    refetch: () => setReloadToken((value) => value + 1),
  }
}

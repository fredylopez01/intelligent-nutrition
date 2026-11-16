import { useCallback, useEffect, useState } from 'react'

import { supplyPurchasesService } from '../services/supplyPurchases.service'
import type { SupplyPurchase, SupplyPurchasesListParams } from '../types/supplyPurchase'
import type { PaginationMeta } from '../types/user'
import { resolveSupplyPurchaseError } from '../utils/supplyPurchases'

import { useAuth } from './useAuth'

interface Result {
  key: string
  status: 'success' | 'error'
  purchases: SupplyPurchase[]
  meta: PaginationMeta | null
  error: string | null
}

export function useSupplyPurchases(params: SupplyPurchasesListParams) {
  const { token } = useAuth()
  const [result, setResult] = useState<Result | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = JSON.stringify({ params, reloadToken })

  useEffect(() => {
    let cancelled = false
    const { params: query } = JSON.parse(requestKey) as { params: SupplyPurchasesListParams }
    supplyPurchasesService
      .list(query, token)
      .then((response) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            status: 'success',
            purchases: response.data,
            meta: response.meta,
            error: null,
          })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            status: 'error',
            purchases: [],
            meta: null,
            error: resolveSupplyPurchaseError(error, 'No fue posible cargar las compras.'),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [requestKey, token])

  const refetch = useCallback(() => setReloadToken((value) => value + 1), [])
  const current = result?.key === requestKey ? result : null
  return {
    status: current?.status ?? ('loading' as const),
    purchases: current?.purchases ?? [],
    meta: current?.meta ?? null,
    error: current?.error ?? null,
    refetch,
  }
}

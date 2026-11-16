import { useCallback, useEffect, useState } from 'react'

import { onlineOrdersService } from '../services/onlineOrders.service'
import type { OnlineOrder, OnlineOrdersListParams } from '../types/onlineOrder'
import type { PaginationMeta } from '../types/user'
import { resolveOrderError } from '../utils/onlineOrders'

import { useAuth } from './useAuth'

interface OrdersResult {
  key: string
  status: 'success' | 'error'
  orders: OnlineOrder[]
  meta: (PaginationMeta & { openOrders: number }) | null
  error: string | null
}

export function useOnlineOrders(params: OnlineOrdersListParams, enabled = true) {
  const { token } = useAuth()
  const [result, setResult] = useState<OrdersResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = JSON.stringify({ params, reloadToken })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const { params: query } = JSON.parse(requestKey) as { params: OnlineOrdersListParams }
    onlineOrdersService
      .list(query, token)
      .then((response) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'success',
          orders: response.data,
          meta: response.meta,
          error: null,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'error',
          orders: [],
          meta: null,
          error: resolveOrderError(err, 'No fue posible cargar los pedidos. Intenta de nuevo.'),
        })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, requestKey, token])

  const refetch = useCallback(() => setReloadToken((value) => value + 1), [])
  const current = result?.key === requestKey ? result : null
  const status: 'idle' | 'loading' | 'success' | 'error' = !enabled
    ? 'idle'
    : (current?.status ?? 'loading')
  return {
    status,
    orders: current?.orders ?? [],
    meta: current?.meta ?? null,
    error: current?.error ?? null,
    refetch,
  }
}

import { useCallback, useEffect, useState } from 'react'

import { promotionsService } from '../services/promotions.service'
import type { Promotion, PromotionsListParams } from '../types/promotion'
import type { PaginationMeta } from '../types/user'
import { resolvePromotionError } from '../utils/promotions'

import { useAuth } from './useAuth'

type RequestStatus = 'loading' | 'success' | 'error'

interface PromotionsResult {
  key: string
  status: Exclude<RequestStatus, 'loading'>
  promotions: Promotion[]
  meta: PaginationMeta | null
  error: string | null
}

export function usePromotions({ page, limit, search, active }: PromotionsListParams) {
  const { token } = useAuth()
  const [result, setResult] = useState<PromotionsResult | null>(null)
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
    promotionsService
      .list({ page, limit, search, active }, token)
      .then((response) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'success',
          promotions: response.data,
          meta: response.meta,
          error: null,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'error',
          promotions: [],
          meta: null,
          error: resolvePromotionError(
            err,
            'No fue posible cargar las promociones. Intenta de nuevo.',
          ),
        })
      })
    return () => {
      cancelled = true
    }
  }, [requestKey, page, limit, search, active, token])

  const refetch = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  const isCurrent = result?.key === requestKey

  return {
    status: isCurrent ? result.status : ('loading' as RequestStatus),
    promotions: isCurrent ? result.promotions : [],
    meta: isCurrent ? result.meta : null,
    error: isCurrent ? result.error : null,
    refetch,
  }
}

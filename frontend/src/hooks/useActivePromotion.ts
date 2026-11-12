import { useEffect, useState } from 'react'

import { promotionsService } from '../services/promotions.service'
import type { Promotion } from '../types/promotion'

import { useAuth } from './useAuth'

interface ActivePromotionResult {
  key: string
  status: 'success' | 'error'
  promotion: Promotion | null
}

export function useActivePromotion(enabled = true) {
  const { token } = useAuth()
  const [result, setResult] = useState<ActivePromotionResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${token ?? ''}|${reloadToken}`

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    promotionsService
      .getActive(token)
      .then((promotion) => {
        if (!cancelled) setResult({ key: requestKey, status: 'success', promotion })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, status: 'error', promotion: null })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, requestKey, token])

  const current = result?.key === requestKey ? result : null
  const status: 'loading' | 'success' | 'error' = current?.status ?? 'loading'
  return {
    status,
    promotion: current?.promotion ?? null,
    reload: () => setReloadToken((value) => value + 1),
  }
}

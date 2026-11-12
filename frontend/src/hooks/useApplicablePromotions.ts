import { useEffect, useState } from 'react'

import { promotionsService } from '../services/promotions.service'
import type { Promotion } from '../types/promotion'

import { useAuth } from './useAuth'

interface ApplicablePromotionsResult {
  key: string
  status: 'success' | 'error'
  promotions: Promotion[]
}

export function useApplicablePromotions(enabled = true) {
  const { token } = useAuth()
  const [result, setResult] = useState<ApplicablePromotionsResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${token ?? ''}|${reloadToken}`

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    promotionsService
      .listApplicable(token)
      .then((promotions) => {
        if (!cancelled) setResult({ key: requestKey, status: 'success', promotions })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, status: 'error', promotions: [] })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, requestKey, token])

  const current = result?.key === requestKey ? result : null
  const status: 'loading' | 'success' | 'error' = current?.status ?? 'loading'
  return {
    status,
    promotions: current ? current.promotions : (result?.promotions ?? []),
    reload: () => setReloadToken((value) => value + 1),
  }
}

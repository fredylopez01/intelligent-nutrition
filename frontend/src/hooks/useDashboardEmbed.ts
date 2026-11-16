import { useEffect, useState } from 'react'

import { reportsService } from '../services/reports.service'
import { resolveDashboardEmbedError } from '../utils/reports'

import { useAuth } from './useAuth'

interface DashboardEmbedResult {
  key: string
  status: 'success' | 'error'
  url: string | null
  error: string | null
}

export function useDashboardEmbed() {
  const { token } = useAuth()
  const [result, setResult] = useState<DashboardEmbedResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${token ?? ''}|${reloadToken}`

  useEffect(() => {
    let cancelled = false
    reportsService
      .dashboardEmbed(token)
      .then(({ url }) => {
        if (!cancelled) setResult({ key: requestKey, status: 'success', url, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'error',
          url: null,
          error: resolveDashboardEmbedError(err),
        })
      })
    return () => {
      cancelled = true
    }
  }, [requestKey, token])

  const current = result?.key === requestKey ? result : null
  return {
    status: current?.status ?? ('loading' as const),
    url: current?.url ?? null,
    error: current?.error ?? null,
    refetch: () => setReloadToken((value) => value + 1),
  }
}

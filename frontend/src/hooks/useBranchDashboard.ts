import { useEffect, useState } from 'react'

import { dashboardService } from '../services/dashboard.service'
import type { BranchDashboard } from '../types/dashboard'
import { GLOBAL_SCOPE, resolveDashboardError } from '../utils/dashboard'

import { useAuth } from './useAuth'

interface DashboardResult {
  key: string
  status: 'success' | 'error'
  dashboard: BranchDashboard | null
  error: string | null
}

export function useBranchDashboard(scope: string | null) {
  const { token } = useAuth()
  const [result, setResult] = useState<DashboardResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${scope ?? ''}|${token ?? ''}|${reloadToken}`

  useEffect(() => {
    if (!scope) return
    let cancelled = false
    const request =
      scope === GLOBAL_SCOPE
        ? dashboardService.global(token)
        : dashboardService.branch(scope, token)
    request
      .then((dashboard) => {
        if (cancelled) return
        setResult({ key: requestKey, status: 'success', dashboard, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'error',
          dashboard: null,
          error: resolveDashboardError(
            err,
            'No fue posible cargar los indicadores. Intenta de nuevo.',
          ),
        })
      })
    return () => {
      cancelled = true
    }
  }, [scope, requestKey, token])

  const current = result?.key === requestKey ? result : null
  const status: 'idle' | 'loading' | 'success' | 'error' = !scope
    ? 'idle'
    : (current?.status ?? 'loading')
  return {
    status,
    dashboard: current?.dashboard ?? null,
    error: current?.error ?? null,
    refetch: () => setReloadToken((value) => value + 1),
  }
}

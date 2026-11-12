import { useEffect, useState } from 'react'

import { reportsService } from '../services/reports.service'
import type { RestockReportRow } from '../types/report'
import { resolveReportError } from '../utils/reports'

import { useAuth } from './useAuth'

interface RestockReportResult {
  key: string
  status: 'success' | 'error'
  rows: RestockReportRow[]
  error: string | null
}

export function useRestockReport(branchId: string | undefined, enabled = true) {
  const { token } = useAuth()
  const [result, setResult] = useState<RestockReportResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${branchId ?? ''}|${token ?? ''}|${reloadToken}`

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    reportsService
      .restock({ branchId }, token)
      .then((rows) => {
        if (!cancelled) setResult({ key: requestKey, status: 'success', rows, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'error',
          rows: [],
          error: resolveReportError(
            err,
            'No fue posible cargar la reposición sugerida. Intenta de nuevo.',
          ),
        })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, requestKey, branchId, token])

  const current = result?.key === requestKey ? result : null
  const status: 'idle' | 'loading' | 'success' | 'error' = !enabled
    ? 'idle'
    : (current?.status ?? 'loading')
  return {
    status,
    rows: current?.rows ?? [],
    error: current?.error ?? null,
    refetch: () => setReloadToken((value) => value + 1),
  }
}

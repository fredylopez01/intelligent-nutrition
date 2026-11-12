import { useEffect, useState } from 'react'

import { reportsService } from '../services/reports.service'
import type { SalesReportParams, SalesReportRow } from '../types/report'
import type { PaginationMeta } from '../types/user'
import { resolveReportError } from '../utils/reports'

import { useAuth } from './useAuth'

interface SalesReportResult {
  key: string
  status: 'success' | 'error'
  rows: SalesReportRow[]
  meta: PaginationMeta | null
  error: string | null
}

export function useSalesReport(params: SalesReportParams, enabled = true) {
  const { token } = useAuth()
  const [result, setResult] = useState<SalesReportResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const { page, limit, branchId, from, to } = params
  const requestKey = [
    page ?? 1,
    limit ?? 20,
    branchId ?? '',
    from ?? '',
    to ?? '',
    token ?? '',
    reloadToken,
  ].join('|')

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    reportsService
      .sales({ page, limit, branchId, from, to }, token)
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
          error: resolveReportError(
            err,
            'No fue posible cargar el reporte de ventas. Intenta de nuevo.',
          ),
        })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, requestKey, page, limit, branchId, from, to, token])

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

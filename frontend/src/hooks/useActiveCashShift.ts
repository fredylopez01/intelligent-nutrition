import { useEffect, useState } from 'react'

import { cashShiftsService } from '../services/cashShifts.service'
import type { CashShift } from '../types/cashShift'

import { useAuth } from './useAuth'

interface ActiveShiftResult {
  key: string
  status: 'success' | 'error'
  shift: CashShift | null
}

export function useActiveCashShift(branchId: string | null) {
  const { token } = useAuth()
  const [result, setResult] = useState<ActiveShiftResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${branchId ?? ''}|${token ?? ''}|${reloadToken}`

  useEffect(() => {
    if (!branchId) return
    let cancelled = false
    cashShiftsService
      .active(branchId, token)
      .then((shift) => {
        if (!cancelled) setResult({ key: requestKey, status: 'success', shift })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, status: 'error', shift: null })
      })
    return () => {
      cancelled = true
    }
  }, [branchId, requestKey, token])

  const current = result?.key === requestKey ? result : null
  const status: 'idle' | 'loading' | 'success' | 'error' = !branchId
    ? 'idle'
    : (current?.status ?? 'loading')
  return {
    status,
    shift: current?.shift ?? null,
    refetch: () => setReloadToken((value) => value + 1),
  }
}

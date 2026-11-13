import { useEffect, useState } from 'react'

import { suppliesService } from '../services/supplies.service'
import { unitsService } from '../services/units.service'
import type { Supply } from '../types/supply'
import type { UnitOfMeasure } from '../types/unit'

import { useAuth } from './useAuth'

const OPTIONS_LIMIT = 100

interface OptionsResult {
  key: string
  status: 'success' | 'error'
  supplies: Supply[]
  units: UnitOfMeasure[]
}

export function useRecipeFormOptions() {
  const { token } = useAuth()
  const [result, setResult] = useState<OptionsResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${token ?? ''}|${reloadToken}`

  useEffect(() => {
    let cancelled = false
    Promise.all([
      suppliesService.list({ page: 1, limit: OPTIONS_LIMIT, active: true }, token),
      unitsService.list({ page: 1, limit: OPTIONS_LIMIT, active: true }, token),
    ])
      .then(([supplies, units]) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'success',
          supplies: supplies.data,
          units: units.data,
        })
      })
      .catch(() => {
        if (cancelled) return
        setResult({ key: requestKey, status: 'error', supplies: [], units: [] })
      })
    return () => {
      cancelled = true
    }
  }, [requestKey, token])

  const current = result?.key === requestKey ? result : null
  return {
    status: current?.status ?? ('loading' as const),
    supplies: current?.supplies ?? [],
    units: current?.units ?? [],
    reload: () => setReloadToken((value) => value + 1),
  }
}

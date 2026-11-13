import { useCallback, useEffect, useState } from 'react'

import { branchesService } from '../services/branches.service'
import type { Branch } from '../types/branch'

interface PublicBranchesResult {
  reloadToken: number
  status: 'success' | 'error'
  branches: Branch[]
}

export function usePublicBranches() {
  const [result, setResult] = useState<PublicBranchesResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    branchesService
      .list({ page: 1, limit: 100 }, null)
      .then((response) => {
        if (!cancelled) setResult({ reloadToken, status: 'success', branches: response.data })
      })
      .catch(() => {
        if (!cancelled) setResult({ reloadToken, status: 'error', branches: [] })
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const reload = useCallback(() => setReloadToken((value) => value + 1), [])
  const current = result?.reloadToken === reloadToken ? result : null
  const branches = [...(current?.branches ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'es'),
  )
  const status: 'loading' | 'success' | 'error' = current?.status ?? 'loading'
  return { status, branches, reload }
}

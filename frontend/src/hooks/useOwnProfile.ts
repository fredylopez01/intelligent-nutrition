import { useEffect, useState } from 'react'

import { profileService } from '../services/profile.service'
import type { OwnProfile } from '../types/profile'
import { resolveProfileError } from '../utils/profile'

import { useAuth } from './useAuth'

interface ProfileResult {
  key: string
  status: 'success' | 'error'
  profile: OwnProfile | null
  error: string | null
}

export function useOwnProfile() {
  const { token } = useAuth()
  const [result, setResult] = useState<ProfileResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${token ?? ''}|${reloadToken}`

  useEffect(() => {
    let cancelled = false
    profileService
      .get(token)
      .then((profile) => {
        if (cancelled) return
        setResult({ key: requestKey, status: 'success', profile, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setResult({
          key: requestKey,
          status: 'error',
          profile: null,
          error: resolveProfileError(err, 'No fue posible cargar tu perfil. Intenta de nuevo.'),
        })
      })
    return () => {
      cancelled = true
    }
  }, [requestKey, token])

  const current = result?.key === requestKey ? result : null
  return {
    status: current?.status ?? ('loading' as const),
    profile: current?.profile ?? null,
    error: current?.error ?? null,
    refetch: () => setReloadToken((value) => value + 1),
    replace: (profile: OwnProfile) =>
      setResult({ key: requestKey, status: 'success', profile, error: null }),
  }
}

import { useEffect, useState } from 'react'

import { onlineOrdersService } from '../services/onlineOrders.service'
import type { CartAvailability, OrderDocumentType, OrderLine } from '../types/onlineOrder'

interface AvailabilityResult {
  key: string
  status: 'success' | 'error'
  availability: CartAvailability | null
}

export function useCartAvailability(lines: OrderLine[]) {
  const key = JSON.stringify(lines)
  const [result, setResult] = useState<AvailabilityResult | null>(null)

  useEffect(() => {
    const parsed = JSON.parse(key) as OrderLine[]
    if (parsed.length === 0) return
    let cancelled = false
    onlineOrdersService
      .availability(parsed)
      .then((availability) => {
        if (!cancelled) setResult({ key, status: 'success', availability })
      })
      .catch(() => {
        if (!cancelled) setResult({ key, status: 'error', availability: null })
      })
    return () => {
      cancelled = true
    }
  }, [key])

  const current = result?.key === key ? result : null
  const status: 'idle' | 'loading' | 'success' | 'error' =
    lines.length === 0 ? 'idle' : (current?.status ?? 'loading')
  return { status, availability: current?.availability ?? result?.availability ?? null }
}

export function useOrderDocumentTypes() {
  const [documentTypes, setDocumentTypes] = useState<OrderDocumentType[]>([])

  useEffect(() => {
    let cancelled = false
    onlineOrdersService
      .documentTypes()
      .then((types) => {
        if (!cancelled) setDocumentTypes(types)
      })
      .catch(() => {
        if (!cancelled) setDocumentTypes([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return documentTypes
}

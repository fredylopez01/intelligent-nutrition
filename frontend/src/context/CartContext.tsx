import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { CartItem } from '../types/onlineOrder'

import { CartContext, MAX_CART_QUANTITY } from './cart-context'
import type { CartState } from './cart-context'

const STORAGE_KEY = 'intelligent-nutrition:cart'

function clampQuantity(quantity: number): number {
  return Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(quantity)))
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? (parsed as CartItem[]).filter(
          (item) => typeof item?.productId === 'string' && Number(item.quantity) > 0,
        )
      : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      return
    }
  }, [items])

  const add = useCallback((item: Omit<CartItem, 'quantity'>, quantity: number) => {
    setItems((previous) => {
      const existing = previous.find((line) => line.productId === item.productId)
      if (!existing) return [...previous, { ...item, quantity: clampQuantity(quantity) }]
      return previous.map((line) =>
        line.productId === item.productId
          ? { ...line, ...item, quantity: clampQuantity(line.quantity + quantity) }
          : line,
      )
    })
  }, [])

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((previous) =>
      previous.map((line) =>
        line.productId === productId ? { ...line, quantity: clampQuantity(quantity) } : line,
      ),
    )
  }, [])

  const remove = useCallback((productId: string) => {
    setItems((previous) => previous.filter((line) => line.productId !== productId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartState>(
    () => ({
      items,
      count: items.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: items.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [items, add, setQuantity, remove, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

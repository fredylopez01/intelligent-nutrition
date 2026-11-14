import { useContext } from 'react'

import { CartContext } from '../context/cart-context'
import type { CartState } from '../context/cart-context'

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart debe usarse dentro de <CartProvider>')
  }
  return ctx
}

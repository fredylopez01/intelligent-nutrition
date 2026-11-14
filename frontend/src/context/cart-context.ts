import { createContext } from 'react'

import type { CartItem } from '../types/onlineOrder'

export const MAX_CART_QUANTITY = 50

export interface CartState {
  items: CartItem[]
  count: number
  subtotal: number
  add: (item: Omit<CartItem, 'quantity'>, quantity: number) => void
  setQuantity: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: () => void
}

export const CartContext = createContext<CartState | null>(null)

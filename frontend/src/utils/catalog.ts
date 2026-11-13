import type { CatalogProduct } from '../types/catalog'

import { shortBranchName } from './dashboard'
import { formatPrice } from './products'

export type AvailabilityTone = 'good' | 'scarce' | 'order'

export interface Availability {
  label: string
  tone: AvailabilityTone
}

export function catalogAvailability(product: CatalogProduct): Availability {
  const [first] = product.branches
  if (!first) return { label: 'Bajo pedido', tone: 'order' }
  if (product.branches.length > 1) {
    return { label: `${product.branches.length} sedes`, tone: 'good' }
  }
  if (first.quantity === 1) {
    return { label: `Última unidad en ${shortBranchName(first.name)}`, tone: 'scarce' }
  }
  return { label: `Solo ${shortBranchName(first.name)}`, tone: 'scarce' }
}

export function branchUnitsLabel(quantity: number): string {
  return quantity === 1 ? 'Última unidad' : `${quantity} unidades`
}

export function productInquiryMessage(product: CatalogProduct): string {
  return `Hola, quiero información sobre ${product.name} (ref. ${product.referenceCode}), ${formatPrice(
    product.price,
  )}.`
}

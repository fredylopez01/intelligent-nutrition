import { describe, expect, it } from 'vitest'

import type { CatalogProduct } from '../types/catalog'

import { branchUnitsLabel, catalogAvailability, productInquiryMessage } from './catalog'

const product: CatalogProduct = {
  productId: 'p-1',
  name: 'Best Whey Vainilla 5lb',
  referenceCode: 'BW-5',
  category: { id: 'c-1', name: 'Proteína' },
  price: '339900.00',
  imageUrl: null,
  branchUnits: 0,
  availableInWarehouse: true,
  branches: [],
}
const viva = { branchId: 'viva', name: 'Intelligent Nutrition - Viva', quantity: 7 }
const makro = { branchId: 'makro', name: 'Sede Makro', quantity: 12 }

describe('catalog utils', () => {
  it('describes where the product can be found', () => {
    expect(catalogAvailability(product)).toEqual({ label: 'Bajo pedido', tone: 'order' })
    expect(catalogAvailability({ ...product, branches: [viva] })).toEqual({
      label: 'Solo Viva',
      tone: 'scarce',
    })
    expect(catalogAvailability({ ...product, branches: [{ ...viva, quantity: 1 }] }).label).toBe(
      'Última unidad en Viva',
    )
    expect(catalogAvailability({ ...product, branches: [makro, viva] })).toEqual({
      label: '2 sedes',
      tone: 'good',
    })
  })

  it('labels the units and writes the WhatsApp question', () => {
    expect(branchUnitsLabel(1)).toBe('Última unidad')
    expect(branchUnitsLabel(12)).toBe('12 unidades')
    expect(productInquiryMessage(product)).toMatch(
      /^Hola, quiero información sobre Best Whey Vainilla 5lb \(ref\. BW-5\), \$\s339\.900\.$/,
    )
  })
})

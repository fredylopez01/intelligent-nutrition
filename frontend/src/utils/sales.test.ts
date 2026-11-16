import { describe, expect, it } from 'vitest'

import { ApiError } from '../services/http'
import { buildPromotion } from '../test-utils/promotions'

import {
  centsToAmount,
  discountReady,
  resolveDiscount,
  centsToInput,
  parseAmountCents,
  paymentsBalance,
  promotionDiscountCents,
  selectionTotalCents,
  stockShortages,
  toCents,
} from './sales'

describe('sale helpers', () => {
  it('adds the lines in cents to avoid rounding errors', () => {
    const lines = [
      { product: { price: '19.99' }, quantity: 3 },
      { product: { price: '0.10' }, quantity: 2 },
    ]

    expect(selectionTotalCents(lines)).toBe(6017)
    expect(centsToAmount(6017)).toBe('60.17')
    expect(toCents('145000.00')).toBe(14500000)
  })

  it('computes the promotion discount in cents rounded like the server', () => {
    expect(promotionDiscountCents(29000000, '15.00')).toBe(4350000)
    expect(promotionDiscountCents(9999999, '12.50')).toBe(1250000)
    expect(promotionDiscountCents(29000000, null)).toBe(0)
    expect(promotionDiscountCents(29000000, undefined)).toBe(0)
  })

  it('reads the amounts typed with thousands separators or decimal commas', () => {
    expect(parseAmountCents('50000')).toBe(5000000)
    expect(parseAmountCents('50.000')).toBe(5000000)
    expect(parseAmountCents('$ 1.250.000')).toBe(125000000)
    expect(parseAmountCents('87.499,99')).toBe(8749999)
    expect(parseAmountCents('1500,5')).toBe(150050)
    expect(parseAmountCents('19.99')).toBe(1999)
    expect(parseAmountCents('')).toBeNull()
    expect(parseAmountCents('abc')).toBeNull()
    expect(parseAmountCents('12,345')).toBeNull()
  })

  it('writes the cents back as an editable amount', () => {
    expect(centsToInput(29000000)).toBe('290000')
    expect(centsToInput(8749999)).toBe('87499,99')
  })

  it('charges the whole total with a single payment', () => {
    expect(paymentsBalance([{ amount: '' }], 29000000)).toMatchObject({
      amounts: [29000000],
      differenceCents: 0,
      matches: true,
    })
  })

  it('compares several payments with the total', () => {
    expect(paymentsBalance([{ amount: '190.000' }, { amount: '100000' }], 29000000)).toMatchObject({
      assignedCents: 29000000,
      differenceCents: 0,
      complete: true,
      matches: true,
    })
    expect(paymentsBalance([{ amount: '100000' }, { amount: '90000' }], 29000000)).toMatchObject({
      differenceCents: 10000000,
      matches: false,
    })
    expect(paymentsBalance([{ amount: '290000' }, { amount: '0' }], 29000000)).toMatchObject({
      amounts: [29000000, null],
      complete: false,
      matches: false,
    })
  })

  it('uses the active promotion when the seller has not chosen a discount', () => {
    const active = buildPromotion({ active: true, discountPercentage: '15.00' })
    const other = buildPromotion({ id: 'promo-other', active: false })

    expect(resolveDiscount(null, [other, active], 29000000)).toMatchObject({
      kind: 'promotion',
      cents: 4350000,
      payload: { promotionId: 'promo-black-friday' },
    })
    expect(resolveDiscount(null, [other], 29000000)).toMatchObject({
      kind: 'none',
      cents: 0,
      payload: { promotionId: null },
    })
  })

  it('flags a chosen promotion that is no longer valid', () => {
    const discount = resolveDiscount({ kind: 'promotion', promotionId: 'gone' }, [], 29000000)

    expect(discount.promotionError).toMatch(/ya no está vigente/)
    expect(discountReady(discount)).toBe(false)
  })

  it('computes a custom discount and requires its reason', () => {
    const percentage = resolveDiscount(
      { kind: 'custom', type: 'percentage', value: '12,5', reason: ' Cliente frecuente ' },
      [],
      9999999,
    )
    expect(percentage).toMatchObject({
      cents: 1250000,
      label: 'Descuento personalizado (12,5 %)',
      payload: {
        promotionId: null,
        discountAmount: '12500.00',
        discountReason: 'Cliente frecuente',
      },
    })

    const missingReason = resolveDiscount(
      { kind: 'custom', type: 'amount', value: '10.000', reason: '' },
      [],
      29000000,
    )
    expect(missingReason).toMatchObject({
      cents: 0,
      reasonError: 'Escribe el motivo del descuento.',
    })
    expect(missingReason.payload).toEqual({ promotionId: null })
    expect(discountReady(missingReason)).toBe(false)

    expect(
      resolveDiscount(
        { kind: 'custom', type: 'amount', value: '300000', reason: 'x' },
        [],
        29000000,
      ).valueError,
    ).toBe('El descuento no puede superar el subtotal de la venta.')
  })

  it('reads the products without enough stock from the api error', () => {
    const shortage = { productName: 'Creatina 300 g', requested: 4, available: 1 }

    expect(
      stockShortages(new ApiError('Short', 422, { items: [shortage] }, 'INSUFFICIENT_STOCK')),
    ).toEqual([shortage])
    expect(stockShortages(new ApiError('Closed', 422, {}, 'INVENTORY_CLOSED'))).toEqual([])
  })
})

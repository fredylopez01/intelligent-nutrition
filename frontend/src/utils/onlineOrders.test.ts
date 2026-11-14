import { describe, expect, it } from 'vitest'

import { ApiError } from '../services/http'
import { buildAvailability, buildOrder } from '../test-utils/onlineOrders'

import {
  customerWhatsappMessage,
  holdLabel,
  isOpenOrder,
  missingInBranch,
  nextOrderActions,
  orderWhatsappMessage,
  resolveOrderError,
} from './onlineOrders'

describe('online order utils', () => {
  it('offers the next step of each order', () => {
    expect(nextOrderActions(buildOrder())).toEqual([
      { status: 'CONFIRMED', label: 'Confirmar pedido' },
    ])
    expect(nextOrderActions(buildOrder({ status: 'CONFIRMED' }))[0].status).toBe('READY')
    expect(
      nextOrderActions(buildOrder({ status: 'CONFIRMED', fulfillment: 'DELIVERY' }))[0].status,
    ).toBe('OUT_FOR_DELIVERY')
    expect(nextOrderActions(buildOrder({ status: 'READY' }))).toEqual([])
    expect(isOpenOrder(buildOrder({ status: 'OUT_FOR_DELIVERY' }))).toBe(true)
    expect(isOpenOrder(buildOrder({ status: 'EXPIRED' }))).toBe(false)
  })

  it('tells how long the hold lasts', () => {
    const now = new Date('2026-11-14T15:00:00.000Z')
    expect(holdLabel(buildOrder({ expiresAt: '2026-11-16T15:00:00.000Z' }), now)).toBe(
      'Vence en 48 h',
    )
    expect(holdLabel(buildOrder({ expiresAt: '2026-11-14T15:30:00.000Z' }), now)).toBe(
      'Vence en menos de una hora',
    )
    expect(holdLabel(buildOrder({ status: 'CONFIRMED' }), now)).toBe('')
  })

  it('lists what a branch is missing for the cart', () => {
    const [, viva] = buildAvailability().branches
    expect(
      missingInBranch(viva, [
        {
          productId: 'p-whey',
          name: 'Whey',
          referenceCode: 'W',
          price: '1',
          imageUrl: null,
          quantity: 2,
        },
      ]),
    ).toEqual([{ name: 'Whey', available: 1 }])
  })

  it('writes the WhatsApp messages for the customer and the store', () => {
    const message = orderWhatsappMessage(buildOrder())
    expect(message).toContain('Hola, hice el pedido P-20261114-0001 en la tienda web.')
    expect(message).toMatch(/2 x Best Whey Vainilla 5lb/)
    expect(message).toContain('Recojo en Sede Makro (Av. Universitaria, Tunja)')
    const delivery = orderWhatsappMessage(
      buildOrder({
        fulfillment: 'DELIVERY',
        delivery: { address: 'Calle 19 # 9-35', neighborhood: 'Centro' },
      }),
    )
    expect(delivery).toContain('Domicilio en Tunja: Calle 19 # 9-35, Centro')
    expect(delivery).toContain('valor del domicilio')
    expect(customerWhatsappMessage(buildOrder())).toBe(
      'Hola Camilo, te escribimos de Intelligent Nutrition por tu pedido P-20261114-0001.',
    )
  })

  it('explains the API errors', () => {
    expect(
      resolveOrderError(
        new ApiError(
          'x',
          422,
          { items: [{ productName: 'Whey', available: 1 }] },
          'INSUFFICIENT_STOCK',
        ),
        'fallback',
      ),
    ).toBe('No hay unidades suficientes de: Whey (1 disponibles). Ajusta las cantidades.')
    expect(
      resolveOrderError(new ApiError('x', 409, undefined, 'EMAIL_ALREADY_IN_USE'), 'f'),
    ).toMatch(/correo ya está registrado/)
    expect(resolveOrderError(new Error('x'), 'fallback')).toBe('fallback')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from './http'
import { onlineOrdersService } from './onlineOrders.service'

vi.mock('./http', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http')>()
  return { ...original, http: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('onlineOrdersService', () => {
  it('uses the public endpoints without a token', async () => {
    await onlineOrdersService.availability([{ productId: 'p-1', quantity: 2 }])
    await onlineOrdersService.documentTypes()
    await onlineOrdersService.create({
      fulfillment: 'PICKUP',
      branchId: 'b-1',
      items: [{ productId: 'p-1', quantity: 2 }],
      customer: { firstName: 'Camilo', lastName: 'Rojas', phone: '3114827719', register: false },
    })

    expect(http.post).toHaveBeenNthCalledWith(1, '/orders/availability', {
      items: [{ productId: 'p-1', quantity: 2 }],
    })
    expect(http.get).toHaveBeenCalledWith('/orders/document-types')
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      '/orders',
      expect.objectContaining({ branchId: 'b-1' }),
    )
  })

  it('sends the staff requests with the token', async () => {
    await onlineOrdersService.list({ page: 1, status: 'PENDING', search: '' }, 'token')
    await onlineOrdersService.updateStatus('o-1', { status: 'CANCELLED', reason: 'x' }, 'token')
    await onlineOrdersService.complete('o-1', { paymentMethodId: 'pm' }, 'token')

    expect(http.get).toHaveBeenCalledWith('/orders?page=1&status=PENDING', { token: 'token' })
    expect(http.patch).toHaveBeenCalledWith(
      '/orders/o-1/status',
      { status: 'CANCELLED', reason: 'x' },
      { token: 'token' },
    )
    expect(http.post).toHaveBeenCalledWith(
      '/orders/o-1/complete',
      { paymentMethodId: 'pm' },
      { token: 'token' },
    )
  })
})

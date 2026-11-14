import type { CartAvailability, OnlineOrder } from '../types/onlineOrder'

export function buildOrder(overrides: Partial<OnlineOrder> = {}): OnlineOrder {
  return {
    id: 'order-1',
    code: 'P-20261114-0001',
    status: 'PENDING',
    fulfillment: 'PICKUP',
    branch: { id: 'makro', name: 'Sede Makro', address: 'Av. Universitaria, Tunja', phone: '3001' },
    customer: {
      id: null,
      name: 'Camilo Rojas',
      phone: '3114827719',
      email: null,
      registered: false,
    },
    delivery: null,
    notes: null,
    items: [
      {
        productId: 'p-whey',
        name: 'Best Whey Vainilla 5lb',
        referenceCode: 'BW-5',
        quantity: 2,
        unitPrice: '339900.00',
        total: '679800.00',
      },
    ],
    subtotal: '679800.00',
    expiresAt: new Date(Date.now() + 47 * 3_600_000).toISOString(),
    sale: null,
    cancelReason: null,
    confirmedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    createdAt: '2026-11-14T15:00:00.000Z',
    ...overrides,
  }
}

export function buildAvailability(overrides: Partial<CartAvailability> = {}): CartAvailability {
  return {
    products: [
      { productId: 'p-whey', name: 'Best Whey Vainilla 5lb', price: '339900.00', quantity: 2 },
    ],
    branches: [
      {
        branchId: 'makro',
        name: 'Sede Makro',
        address: 'Av. Universitaria, Tunja',
        phone: '3001',
        deliveryEnabled: true,
        allAvailable: true,
        items: [{ productId: 'p-whey', available: 12 }],
      },
      {
        branchId: 'viva',
        name: 'Sede Viva',
        address: 'Av. Norte, Tunja',
        phone: '3002',
        deliveryEnabled: false,
        allAvailable: false,
        items: [{ productId: 'p-whey', available: 1 }],
      },
    ],
    deliveryAvailable: true,
    ...overrides,
  }
}

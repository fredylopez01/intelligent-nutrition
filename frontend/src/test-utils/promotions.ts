import type { Promotion } from '../types/promotion'

export function buildPromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'promo-black-friday',
    name: 'Black Friday',
    discountPercentage: '15.00',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    active: false,
    createdAt: '2026-10-20T15:00:00.000Z',
    updatedAt: '2026-10-20T15:00:00.000Z',
    ...overrides,
  }
}

export const BLACK_FRIDAY = buildPromotion()

export const SUMMER = buildPromotion({
  id: 'promo-summer',
  name: 'Verano saludable',
  discountPercentage: '10.00',
  startDate: null,
  endDate: null,
  active: true,
})

export function promotionsPage(
  data: Promotion[],
  meta: Partial<{ page: number; total: number; totalPages: number }> = {},
) {
  return {
    data,
    meta: {
      page: meta.page ?? 1,
      limit: 10,
      total: meta.total ?? data.length,
      totalPages: meta.totalPages ?? (data.length ? 1 : 0),
    },
  }
}

import type {
  CatalogCategory,
  CatalogListParams,
  CatalogListResponse,
  CatalogProductDetail,
} from '../types/catalog'

import { http } from './http'

function buildQuery(params: CatalogListParams): string {
  const query = new URLSearchParams()
  if (params.page !== undefined) query.set('page', String(params.page))
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.search) query.set('search', params.search)
  if (params.categoryId) query.set('categoryId', params.categoryId)
  if (params.branchId) query.set('branchId', params.branchId)
  if (params.sort && params.sort !== 'name') query.set('sort', params.sort)
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const catalogService = {
  products: (params: CatalogListParams): Promise<CatalogListResponse> =>
    http.get<CatalogListResponse>(`/catalog/products${buildQuery(params)}`),

  categories: (): Promise<CatalogCategory[]> => http.get<CatalogCategory[]>('/catalog/categories'),

  product: (productId: string): Promise<CatalogProductDetail> =>
    http.get<CatalogProductDetail>(`/catalog/products/${productId}`),
}

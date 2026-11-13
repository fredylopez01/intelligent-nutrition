export interface CatalogBranchAvailability {
  branchId: string
  name: string
  quantity: number
}

export interface CatalogProduct {
  productId: string
  name: string
  referenceCode: string
  category: { id: string; name: string }
  price: string
  imageUrl: string | null
  branchUnits: number
  availableInWarehouse: boolean
  branches: CatalogBranchAvailability[]
}

export interface CatalogProductDetail extends CatalogProduct {
  description: string | null
  images: string[]
}

export interface CatalogCategory {
  categoryId: string
  name: string
  productCount: number
}

export type CatalogSort = 'name' | 'price_asc' | 'price_desc'

export interface CatalogListParams {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
  branchId?: string
  sort?: CatalogSort
}

export interface CatalogListResponse {
  data: CatalogProduct[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

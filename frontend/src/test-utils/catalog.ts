import type { CatalogListResponse, CatalogProduct } from '../types/catalog'

export const catalogProducts: CatalogProduct[] = [
  {
    productId: 'p-whey',
    name: 'Best Whey Vainilla 5lb',
    referenceCode: 'BW-5',
    category: { id: 'c-protein', name: 'Proteína' },
    price: '339900.00',
    imageUrl: null,
    branchUnits: 21,
    availableInWarehouse: false,
    branches: [
      { branchId: 'makro', name: 'Sede Makro', quantity: 12 },
      { branchId: 'viva', name: 'Sede Viva', quantity: 7 },
      { branchId: 'sogamoso', name: 'Sede Sogamoso', quantity: 2 },
    ],
  },
  {
    productId: 'p-creatine',
    name: 'Iron Creatina Ultra Pure 500g',
    referenceCode: 'IRON',
    category: { id: 'c-creatine', name: 'Creatina' },
    price: '109990.00',
    imageUrl: 'https://cdn.test/iron.webp',
    branchUnits: 1,
    availableInWarehouse: true,
    branches: [{ branchId: 'sogamoso', name: 'Sede Sogamoso', quantity: 1 }],
  },
]

export function catalogPage(
  data: CatalogProduct[] = catalogProducts,
  meta: Partial<CatalogListResponse['meta']> = {},
): CatalogListResponse {
  return {
    data,
    meta: { page: 1, limit: 12, total: data.length, totalPages: 1, ...meta },
  }
}

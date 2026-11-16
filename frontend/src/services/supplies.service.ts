import type {
  ConvertProductPayload,
  CreateSupplyPayload,
  ProductConversion,
  Supply,
  SuppliesListParams,
  SuppliesListResponse,
  SupplyMovement,
  SupplyMovementPayload,
  SupplyStockParams,
  SupplyStockResponse,
  SupplyStockRow,
  SupplyUnit,
  UpdateSupplyLinkPayload,
  UpdateSupplyMinimumPayload,
} from '../types/supply'
import type { PaginationMeta } from '../types/user'

import { http } from './http'

const SUPPLIES_PATH = '/supplies'
const SUPPLY_STOCK_PATH = '/supply-stock'

interface ApiSupplyUnit {
  id: string
  name?: string
  abbreviation?: string
  abreviation?: string
}

interface ApiSupply extends Omit<Supply, 'unitOfMeasure'> {
  unitOfMeasure: ApiSupplyUnit
}

export function normalizeSupplyUnit(unit: ApiSupplyUnit): SupplyUnit {
  return {
    id: unit.id,
    ...(unit.name !== undefined ? { name: unit.name } : {}),
    abbreviation: unit.abbreviation ?? unit.abreviation ?? '',
  }
}

export function normalizeSupply(supply: ApiSupply): Supply {
  return { ...supply, unitOfMeasure: normalizeSupplyUnit(supply.unitOfMeasure) }
}

interface ApiSupplyStockRow extends Omit<SupplyStockRow, 'supply'> {
  supply: { name: string; unitOfMeasure: ApiSupplyUnit }
}

function normalizeStockRow(row: ApiSupplyStockRow): SupplyStockRow {
  const unit = normalizeSupplyUnit(row.supply.unitOfMeasure)
  return {
    ...row,
    supply: {
      name: row.supply.name,
      unitOfMeasure: { id: unit.id, abbreviation: unit.abbreviation },
    },
  }
}

export function buildQuery(params: object): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const suppliesService = {
  list: async (params: SuppliesListParams, token: string | null): Promise<SuppliesListResponse> => {
    const response = await http.get<{ data: ApiSupply[]; meta: PaginationMeta }>(
      `${SUPPLIES_PATH}${buildQuery(params)}`,
      { token },
    )
    return { data: response.data.map(normalizeSupply), meta: response.meta }
  },

  create: async (payload: CreateSupplyPayload, token: string | null): Promise<Supply> =>
    normalizeSupply(await http.post<ApiSupply>(SUPPLIES_PATH, payload, { token })),

  updateLink: async (
    supplyId: string,
    payload: UpdateSupplyLinkPayload,
    token: string | null,
  ): Promise<Supply> =>
    normalizeSupply(
      await http.patch<ApiSupply>(`${SUPPLIES_PATH}/${supplyId}`, payload, { token }),
    ),

  stock: async (params: SupplyStockParams, token: string | null): Promise<SupplyStockResponse> => {
    const response = await http.get<{ data: ApiSupplyStockRow[]; meta: PaginationMeta }>(
      `${SUPPLY_STOCK_PATH}${buildQuery(params)}`,
      { token },
    )
    return { data: response.data.map(normalizeStockRow), meta: response.meta }
  },

  move: (payload: SupplyMovementPayload, token: string | null) =>
    http.post<SupplyMovement>(`${SUPPLY_STOCK_PATH}/movement`, payload, { token }),

  convert: (payload: ConvertProductPayload, token: string | null) =>
    http.post<ProductConversion>(`${SUPPLY_STOCK_PATH}/conversions`, payload, { token }),

  setMinimum: async (
    payload: UpdateSupplyMinimumPayload,
    token: string | null,
  ): Promise<SupplyStockRow> =>
    normalizeStockRow(
      await http.patch<ApiSupplyStockRow>(`${SUPPLY_STOCK_PATH}/minimum`, payload, { token }),
    ),
}

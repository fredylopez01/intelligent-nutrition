import type { Supply, SuppliesListParams, SuppliesListResponse, SupplyUnit } from '../types/supply'
import type { PaginationMeta } from '../types/user'

import { http } from './http'

const SUPPLIES_PATH = '/supplies'

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
}

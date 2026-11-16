import { describe, expect, it } from 'vitest'

import { ApiError } from '../services/http'

import {
  buildMovementSchema,
  formatSupplyQuantity,
  isSupplyLow,
  parseMinimum,
  resolveSupplyError,
} from './supplies'

describe('supply utils', () => {
  it('formats quantities and detects the low stock', () => {
    expect(formatSupplyQuantity('1500.000', 'ml')).toBe('1.500 ml')
    expect(formatSupplyQuantity('0.250')).toBe('0,25')
    expect(isSupplyLow({ quantity: '4.000', minimumQuantity: '5.000' })).toBe(true)
    expect(isSupplyLow({ quantity: '5.000', minimumQuantity: '5.000' })).toBe(false)
  })

  it('validates a movement against the available stock', () => {
    const schema = buildMovementSchema(10, 'g')

    expect(
      schema.safeParse({ movementType: 'ENTRY', quantity: '50', observation: '' }).success,
    ).toBe(true)
    expect(
      schema.safeParse({ movementType: 'EXIT', quantity: '11', observation: 'Uso' }).success,
    ).toBe(false)
    expect(
      schema.safeParse({ movementType: 'EXIT', quantity: '10', observation: '' }).success,
    ).toBe(false)
    expect(
      schema.safeParse({ movementType: 'ENTRY', quantity: '1.5', observation: '' }).success,
    ).toBe(false)
  })

  it('parses the minimum with a comma or a dot', () => {
    expect(parseMinimum('2,5')).toBe(2.5)
    expect(parseMinimum('0')).toBe(0)
    expect(parseMinimum('-1')).toBeNull()
  })

  it('explains the errors of the server', () => {
    expect(
      resolveSupplyError(new ApiError('x', 409, undefined, 'SUPPLY_NAME_ALREADY_EXISTS'), 'f'),
    ).toBe('Ya existe un insumo con ese nombre.')
    expect(resolveSupplyError(new ApiError('x', 403), 'f')).toBe(
      'Tu rol no puede hacer esta acción con los insumos.',
    )
  })
})

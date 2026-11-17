import { describe, expect, it } from 'vitest'

import { ApiError } from '../services/http'

import {
  buildMovementSchema,
  formatSupplyQuantity,
  guessSupplyUnit,
  isSupplyLow,
  parseMinimum,
  resolveSupplyError,
  suggestProductYield,
  yieldWarning,
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

describe('product yield', () => {
  it('reads the content of the product name in the unit of the supply', () => {
    expect(suggestProductYield('Colágeno hidrolizado 300 g', 'g')).toMatchObject({
      kind: 'match',
      quantity: 300,
    })
    expect(suggestProductYield('Proteína Whey Chocolate 2 lb', 'g')).toMatchObject({
      kind: 'match',
      quantity: 907,
      converted: true,
    })
    expect(suggestProductYield('Creatina 1 kg', 'kg')).toMatchObject({ quantity: 1 })
    expect(suggestProductYield('Creatina 1,5 kg', 'g')).toMatchObject({ quantity: 1500 })
    expect(suggestProductYield('Multivitamínico diario 60 cápsulas', 'cap')).toMatchObject({
      quantity: 60,
    })
    expect(suggestProductYield('Shaker deportivo 700 ml', 'ml')).toMatchObject({ quantity: 700 })
  })

  it('ignores doses and names without content', () => {
    expect(suggestProductYield('Omega 3 1000 mg 60 cápsulas', 'cap')).toMatchObject({
      quantity: 60,
    })
    expect(suggestProductYield('Vitamina C 1000 mg 30 cápsulas', 'g')).toEqual({
      kind: 'mismatch',
      text: '30 cápsulas',
    })
    expect(suggestProductYield('Shot de colágeno', 'g')).toBeNull()
    expect(suggestProductYield('Colágeno 300 g', undefined)).toBeNull()
  })

  it('warns about a yield or a unit that does not match the product', () => {
    expect(yieldWarning('Proteína vegetal natural 1 lb', 'g', '900')).toBe(
      'El producto dice 1 lb (≈ 454 g) y escribiste 900 g. Revisa el rendimiento.',
    )
    expect(yieldWarning('Colágeno hidrolizado 300 g', 'g', '300')).toBeNull()
    expect(yieldWarning('Proteína Whey 2 lb', 'g', '900')).toBeNull()
    expect(yieldWarning('Fibra soluble 250 g', 'cap', '250')).toBe(
      'El producto dice 250 g y el insumo se mide en cap. Revisa la unidad.',
    )
  })

  it('guesses the unit of the supply from the product name', () => {
    expect(guessSupplyUnit('Proteína Whey 2 lb')).toBe('g')
    expect(guessSupplyUnit('Bebida 1 litro')).toBe('ml')
    expect(guessSupplyUnit('Omega 3 60 cápsulas')).toBe('cap')
    expect(guessSupplyUnit('Shot de colágeno')).toBeNull()
  })

  it('explains the link conflicts of the server', () => {
    expect(
      resolveSupplyError(
        new ApiError(
          'x',
          409,
          { supplyName: 'Colágeno 300 g', supplyActive: true },
          'PRODUCT_ALREADY_LINKED',
        ),
        'fallback',
      ),
    ).toBe('Ese producto ya es el insumo «Colágeno 300 g». Úsalo en lugar de crear otro.')
    expect(
      resolveSupplyError(
        new ApiError('x', 422, { recipeName: 'Batido' }, 'PRODUCT_IS_PREPARED'),
        'fallback',
      ),
    ).toBe('Ese producto se prepara con la receta «Batido», así que no puede ser un insumo.')
  })
})

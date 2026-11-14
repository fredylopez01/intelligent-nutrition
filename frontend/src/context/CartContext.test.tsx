import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { useCart } from '../hooks/useCart'

import { CartProvider } from './CartContext'

const whey = {
  productId: 'p-whey',
  name: 'Whey',
  referenceCode: 'W',
  price: '100000.00',
  imageUrl: null,
}

function Probe() {
  const cart = useCart()
  return (
    <div>
      <p data-testid="summary">{`${cart.count}|${cart.subtotal}`}</p>
      <button type="button" onClick={() => cart.add(whey, 2)}>
        add
      </button>
      <button type="button" onClick={() => cart.setQuantity('p-whey', 80)}>
        many
      </button>
      <button type="button" onClick={() => cart.remove('p-whey')}>
        remove
      </button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('CartProvider', () => {
  it('adds, limits, removes and remembers the cart', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'add' }))
    await user.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getByTestId('summary')).toHaveTextContent('4|400000')
    await user.click(screen.getByRole('button', { name: 'many' }))
    expect(screen.getByTestId('summary')).toHaveTextContent('50|5000000')
    unmount()

    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    )
    expect(screen.getByTestId('summary')).toHaveTextContent('50|5000000')
    await user.click(screen.getByRole('button', { name: 'remove' }))
    expect(screen.getByTestId('summary')).toHaveTextContent('0|0')
  })

  it('ignores a broken stored cart', () => {
    localStorage.setItem('intelligent-nutrition:cart', '{not json')
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    )

    expect(screen.getByTestId('summary')).toHaveTextContent('0|0')
  })
})

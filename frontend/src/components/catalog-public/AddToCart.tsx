import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useCart } from '../../hooks/useCart'
import type { CatalogProductDetail } from '../../types/catalog'

import './AddToCart.css'

export function AddToCart({ product }: { product: CatalogProductDetail }) {
  const { items, add } = useCart()
  const inCart = items.find((item) => item.productId === product.productId)?.quantity ?? 0
  const maxInBranch = Math.max(0, ...product.branches.map((branch) => branch.quantity))
  const remaining = Math.max(0, maxInBranch - inCart)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  if (maxInBranch === 0) {
    return (
      <p className="add-to-cart__note">
        Este producto está en bodega y llega bajo pedido. Escríbenos por WhatsApp para apartarlo.
      </p>
    )
  }

  const safeQuantity = Math.min(quantity, Math.max(1, remaining))
  const handleAdd = () => {
    add(
      {
        productId: product.productId,
        name: product.name,
        referenceCode: product.referenceCode,
        price: product.price,
        imageUrl: product.imageUrl,
      },
      safeQuantity,
    )
    setQuantity(1)
    setAdded(true)
  }

  return (
    <div className="add-to-cart">
      <div className="add-to-cart__row">
        <div className="add-to-cart__stepper" role="group" aria-label="Cantidad">
          <button
            type="button"
            aria-label="Quitar una unidad"
            disabled={safeQuantity <= 1}
            onClick={() => setQuantity(safeQuantity - 1)}
          >
            −
          </button>
          <output aria-live="polite">{safeQuantity}</output>
          <button
            type="button"
            aria-label="Agregar una unidad"
            disabled={safeQuantity >= remaining}
            onClick={() => setQuantity(safeQuantity + 1)}
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="add-to-cart__button"
          disabled={remaining === 0}
          onClick={handleAdd}
        >
          {remaining === 0 ? 'Ya tienes todas las unidades' : 'Agregar al pedido'}
        </button>
      </div>
      {added && (
        <p className="add-to-cart__added" role="status">
          Agregado a tu pedido. <Link to="/pedido">Ver pedido</Link>
        </p>
      )}
      <p className="add-to-cart__note">
        Apartas sin pagar en línea: guardamos el producto 48 horas y coordinamos el pago por
        WhatsApp. También hacemos domicilios en Tunja.
      </p>
    </div>
  )
}

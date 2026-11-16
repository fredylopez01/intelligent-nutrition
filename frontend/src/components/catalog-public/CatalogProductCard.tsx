import { Link } from 'react-router-dom'

import type { CatalogProduct } from '../../types/catalog'
import { catalogAvailability } from '../../utils/catalog'
import { formatPrice } from '../../utils/products'

import { CatalogImage } from './CatalogImage'

import './CatalogProductCard.css'

export function CatalogProductCard({ product }: { product: CatalogProduct }) {
  const availability = catalogAvailability(product)
  return (
    <li className="catalog-card">
      <Link className="catalog-card__link" to={`/productos/${product.productId}`}>
        <div className="catalog-card__media">
          <CatalogImage src={product.imageUrl} alt="" placeholder="Foto producto" lazy />
        </div>
        <div className="catalog-card__body">
          <p className="catalog-card__category">{product.category.name}</p>
          <h3 className="catalog-card__name">{product.name}</h3>
          <div className="catalog-card__footer">
            <span className="catalog-card__price">{formatPrice(product.price)}</span>
            <span className={`catalog-card__stock catalog-card__stock--${availability.tone}`}>
              {availability.label}
            </span>
          </div>
        </div>
      </Link>
    </li>
  )
}

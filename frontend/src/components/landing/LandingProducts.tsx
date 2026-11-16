import { Link } from 'react-router-dom'

import { useCatalogProducts } from '../../hooks/useCatalog'
import { CatalogProductCard } from '../catalog-public/CatalogProductCard'

import './LandingProducts.css'

const FEATURED = { page: 1, limit: 4 }

export function LandingProducts() {
  const { status, products, meta, reload } = useCatalogProducts(FEATURED)
  return (
    <section className="landing__section" id="productos" aria-labelledby="productos-title">
      <div className="landing__section-head">
        <div>
          <p className="landing__eyebrow">Catálogo</p>
          <h2 className="landing__section-title" id="productos-title">
            Nuestros productos
          </h2>
        </div>
        <Link className="landing__section-note" to="/productos">
          {meta && meta.total > 0
            ? `Ver catálogo completo (${meta.total})`
            : 'Ver catálogo completo'}
        </Link>
      </div>
      {status === 'loading' && (
        <ul className="landing-products" aria-label="Cargando productos" aria-busy="true">
          {[0, 1, 2, 3].map((index) => (
            <li key={index} className="landing-products__skeleton" aria-hidden="true" />
          ))}
        </ul>
      )}
      {status === 'error' && (
        <div className="landing-products__message">
          <p>No pudimos cargar los productos en este momento.</p>
          <button type="button" className="landing-products__retry" onClick={reload}>
            Reintentar
          </button>
        </div>
      )}
      {status === 'success' && products.length === 0 && (
        <div className="landing-products__message">
          <p>Estamos actualizando el catálogo. Escríbenos y te contamos qué hay disponible.</p>
        </div>
      )}
      {status === 'success' && products.length > 0 && (
        <ul className="landing-products" aria-label="Productos destacados">
          {products.map((product) => (
            <CatalogProductCard key={product.productId} product={product} />
          ))}
        </ul>
      )}
    </section>
  )
}

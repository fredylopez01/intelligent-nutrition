import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { CatalogImage } from '../../components/catalog-public/CatalogImage'
import { PublicLayout } from '../../components/landing/PublicLayout'
import { useCatalogProduct } from '../../hooks/useCatalog'
import { branchUnitsLabel, productInquiryMessage } from '../../utils/catalog'
import { CONTACT, whatsappUrl } from '../../utils/contact'
import { shortBranchName } from '../../utils/dashboard'
import { formatPrice } from '../../utils/products'

import './PublicCatalog.css'

interface ProductViewProps {
  productId: string | undefined
  whatsapp: string
}

export function PublicProductPage({ whatsapp = CONTACT.whatsapp }: { whatsapp?: string }) {
  const { productId } = useParams()
  return <ProductView key={productId} productId={productId} whatsapp={whatsapp} />
}

function ProductView({ productId, whatsapp }: ProductViewProps) {
  const { status, product, reload } = useCatalogProduct(productId)
  const [selectedImage, setSelectedImage] = useState(0)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [productId])

  useEffect(() => {
    if (!product) return
    const previous = document.title
    document.title = `${product.name} | Intelligent Nutrition`
    return () => {
      document.title = previous
    }
  }, [product])

  const crumbs = (
    <nav className="public-catalog__crumbs" aria-label="Ruta de navegación">
      <Link to="/">Inicio</Link>
      <span aria-hidden="true">/</span>
      <Link to="/productos">Catálogo</Link>
      {product && (
        <>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </>
      )}
    </nav>
  )

  if (status === 'not-found' || status === 'error' || !product) {
    return (
      <PublicLayout>
        <main className="public-catalog">
          {crumbs}
          {status === 'loading' ? (
            <div className="public-product" role="status" aria-label="Cargando producto">
              <div className="public-product__media public-catalog__skeleton" />
              <div className="public-product__info">
                <span className="public-catalog__skeleton public-product__bone" />
                <span className="public-catalog__skeleton public-product__bone" />
              </div>
            </div>
          ) : (
            <div className="public-catalog__message">
              <p>
                {status === 'not-found'
                  ? 'Este producto ya no está disponible en el catálogo.'
                  : 'No pudimos cargar el producto en este momento.'}
              </p>
              {status === 'error' ? (
                <button type="button" onClick={reload}>
                  Reintentar
                </button>
              ) : (
                <Link to="/productos">Ver el catálogo</Link>
              )}
            </div>
          )}
        </main>
      </PublicLayout>
    )
  }

  const images = product.images
  const mainImage = images[Math.min(selectedImage, images.length - 1)]

  return (
    <PublicLayout>
      <main className="public-catalog">
        {crumbs}
        <div className="public-product">
          <div className="public-product__gallery">
            <div className="public-product__media">
              <CatalogImage
                src={mainImage}
                alt={product.name}
                placeholder="Foto principal del producto"
              />
            </div>
            {images.length > 1 && (
              <div className="public-product__thumbs">
                {images.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    className="public-product__thumb"
                    aria-label={`Ver foto ${index + 1} de ${images.length}`}
                    aria-pressed={index === selectedImage}
                    onClick={() => setSelectedImage(index)}
                  >
                    <CatalogImage src={url} alt="" placeholder={`Foto ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="public-product__info">
            <p className="public-product__category">{product.category.name}</p>
            <h1 className="public-product__name">{product.name}</h1>
            <p className="public-product__price">{formatPrice(product.price)}</p>
            <p className="public-product__reference">Ref. {product.referenceCode}</p>

            <section className="public-product__stock" aria-labelledby="product-stock-title">
              <h2 id="product-stock-title">Disponibilidad por sede</h2>
              <ul>
                {product.branches.map((branch) => (
                  <li key={branch.branchId}>
                    <span>{shortBranchName(branch.name)}</span>
                    <span
                      className={
                        branch.quantity <= 2
                          ? 'public-product__units public-product__units--scarce'
                          : 'public-product__units'
                      }
                    >
                      {branchUnitsLabel(branch.quantity)}
                    </span>
                  </li>
                ))}
                {product.availableInWarehouse && (
                  <li>
                    <span>Bodega central</span>
                    <span className="public-product__units public-product__units--order">
                      Bajo pedido
                    </span>
                  </li>
                )}
              </ul>
            </section>

            {whatsapp && (
              <a
                className="public-product__cta"
                href={whatsappUrl(whatsapp, productInquiryMessage(product))}
                target="_blank"
                rel="noreferrer noopener"
              >
                Preguntar por WhatsApp
              </a>
            )}
            <p className="public-product__note">
              Te ayudamos a apartarlo en una sede o a coordinar el envío en Tunja.
            </p>

            {product.description && (
              <section className="public-product__description" aria-labelledby="product-desc">
                <h2 id="product-desc">Descripción</h2>
                <p>{product.description}</p>
              </section>
            )}
          </div>
        </div>
      </main>
    </PublicLayout>
  )
}

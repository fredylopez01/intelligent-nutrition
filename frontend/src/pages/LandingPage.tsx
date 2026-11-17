import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { LandingProducts } from '../components/landing/LandingProducts'
import { LandingStores } from '../components/landing/LandingStores'
import { PublicLayout } from '../components/landing/PublicLayout'
import { CatalogImage } from '../components/catalog-public/CatalogImage'
import { useBrandAssets } from '../hooks/useBrandAssets'
import { usePublicBranches } from '../hooks/usePublicBranches'
import { branchesHighlight, heroStockLabel } from '../utils/landing'

const HERO_IMAGE_URL = 'https://cdn-dev.intelligentnutrition.shop/brading/landing-page-2.jpeg'
const ORIGINAL = { title: '100% original', description: 'Producto con importador verificable' }
const ADVICE = {
  title: 'Asesoría incluida',
  description: 'Acompañamiento al elegir y al dosificar',
}

export function LandingPage() {
  const { isotipo } = useBrandAssets()
  const { hash } = useLocation()

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  const branchState = usePublicBranches()
  const highlights = [ORIGINAL, branchesHighlight(branchState.status, branchState.branches), ADVICE]

  return (
    <PublicLayout>
      <section className="landing__hero">
        <div className="landing__hero-glow" aria-hidden="true" />
        <img className="landing__hero-mark" src={isotipo} alt="" aria-hidden="true" />
        <div className="landing__hero-copy">
          <h1 className="landing__title">
            Suplementación
            <br />
            con criterio, no
            <br />
            con promesas.
          </h1>
          <p className="landing__subtitle">
            Marcas originales, stock verificado y asesoría en sede para elegir lo que tu
            entrenamiento necesita.
          </p>
          <div className="landing__hero-actions">
            <Link className="landing__cta" to="/productos">
              Ver catálogo
            </Link>
            <a className="landing__cta landing__cta--ghost" href="#sedes">
              Visitar una sede
            </a>
          </div>
        </div>
        <div className="landing__hero-media">
          <div className="landing__hero-image">
            <CatalogImage
              src={HERO_IMAGE_URL}
              alt="Producto o sede"
              placeholder="Foto principal: producto o sede"
            />
          </div>
          <div className="landing__hero-card">
            <p className="landing__eyebrow">Inventario en vivo</p>
            <p className="landing__hero-card-value">
              {heroStockLabel(branchState.status, branchState.branches)}
            </p>
          </div>
        </div>
      </section>
      <section className="landing__highlights" aria-label="Por qué comprar aquí">
        {highlights.map((item) => (
          <div className="landing__highlight" key={item.title}>
            <p className="landing__highlight-title">{item.title}</p>
            <p className="landing__highlight-description">{item.description}</p>
          </div>
        ))}
      </section>
      <LandingProducts />
      <LandingStores {...branchState} />
    </PublicLayout>
  )
}

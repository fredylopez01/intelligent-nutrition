import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { CatalogProductCard } from '../../components/catalog-public/CatalogProductCard'
import { PublicLayout } from '../../components/landing/PublicLayout'
import { useCatalogCategories, useCatalogProducts } from '../../hooks/useCatalog'
import { usePublicBranches } from '../../hooks/usePublicBranches'
import type { CatalogSort } from '../../types/catalog'
import { shortBranchName } from '../../utils/dashboard'

import './PublicCatalog.css'

const PAGE_SIZE = 12
const SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'name', label: 'Nombre' },
  { value: 'price_asc', label: 'Menor precio' },
  { value: 'price_desc', label: 'Mayor precio' },
]

function isSort(value: string | null): value is CatalogSort {
  return SORTS.some((sort) => sort.value === value)
}

export function PublicCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('categoria') ?? undefined
  const branchId = searchParams.get('sede') ?? undefined
  const search = searchParams.get('q') ?? undefined
  const rawSort = searchParams.get('orden')
  const sort: CatalogSort = isSort(rawSort) ? rawSort : 'name'
  const page = Math.max(1, Number(searchParams.get('pagina')) || 1)
  const [draft, setDraft] = useState(search ?? '')
  const [searchError, setSearchError] = useState<string | null>(null)

  const { status, products, meta, reload } = useCatalogProducts({
    page,
    limit: PAGE_SIZE,
    categoryId,
    branchId,
    search,
    sort,
  })
  const { categories } = useCatalogCategories()
  const { branches } = usePublicBranches()
  const activeBranches = branches.filter((branch) => branch.active)
  const selectedBranch = activeBranches.find((branch) => branch.id === branchId)
  const visibleCategories = categories.filter((category) => category.productCount > 0)
  const totalAll = visibleCategories.reduce((sum, category) => sum + category.productCount, 0)
  const hasFilters = Boolean(categoryId || branchId || search)

  useEffect(() => {
    const previous = document.title
    document.title = 'Catálogo | Intelligent Nutrition'
    window.scrollTo({ top: 0 })
    return () => {
      document.title = previous
    }
  }, [])

  const update = (changes: Record<string, string | undefined>) =>
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      if (!('pagina' in changes)) next.delete('pagina')
      return next
    })

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const term = draft.trim()
    if (term.length === 1) {
      setSearchError('Escribe al menos 2 letras.')
      return
    }
    setSearchError(null)
    update({ q: term || undefined })
  }

  const clearFilters = () => {
    setDraft('')
    setSearchError(null)
    setSearchParams(new URLSearchParams())
  }

  const total = meta?.total ?? 0
  const subtitle =
    status !== 'success'
      ? 'Cargando productos...'
      : `${total} ${total === 1 ? 'producto disponible' : 'productos disponibles'}${
          selectedBranch ? ` en ${shortBranchName(selectedBranch.name)}` : ''
        }`

  return (
    <PublicLayout>
      <main className="public-catalog">
        <nav className="public-catalog__crumbs" aria-label="Ruta de navegación">
          <Link to="/">Inicio</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Catálogo</span>
        </nav>
        <div className="public-catalog__head">
          <div>
            <h1 className="public-catalog__title">Catálogo</h1>
            <p className="public-catalog__subtitle" aria-live="polite">
              {subtitle}
            </p>
          </div>
          <div className="public-catalog__controls">
            <form className="public-catalog__search" role="search" onSubmit={submitSearch}>
              <label className="sr-only" htmlFor="catalog-search">
                Buscar productos
              </label>
              <input
                id="catalog-search"
                type="search"
                placeholder="Buscar producto o marca"
                value={draft}
                aria-invalid={searchError ? true : undefined}
                aria-describedby={searchError ? 'catalog-search-error' : undefined}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit">Buscar</button>
              {searchError && (
                <p id="catalog-search-error" className="public-catalog__search-error">
                  {searchError}
                </p>
              )}
            </form>
            <label className="public-catalog__select">
              <span>Sede</span>
              <select
                value={selectedBranch?.id ?? ''}
                onChange={(event) => update({ sede: event.target.value || undefined })}
              >
                <option value="">Todas</option>
                {activeBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {shortBranchName(branch.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="public-catalog__select">
              <span>Ordenar</span>
              <select
                value={sort}
                onChange={(event) =>
                  update({ orden: event.target.value === 'name' ? undefined : event.target.value })
                }
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {visibleCategories.length > 0 && (
          <div className="public-catalog__chips" role="group" aria-label="Categorías">
            <button
              type="button"
              className="public-catalog__chip"
              aria-pressed={!categoryId}
              onClick={() => update({ categoria: undefined })}
            >
              Todo <span>{totalAll}</span>
            </button>
            {visibleCategories.map((category) => (
              <button
                key={category.categoryId}
                type="button"
                className="public-catalog__chip"
                aria-pressed={categoryId === category.categoryId}
                onClick={() => update({ categoria: category.categoryId })}
              >
                {category.name} <span>{category.productCount}</span>
              </button>
            ))}
          </div>
        )}

        {status === 'loading' && (
          <ul className="public-catalog__grid" aria-label="Cargando productos" aria-busy="true">
            {Array.from({ length: 8 }, (_, index) => (
              <li key={index} className="public-catalog__skeleton" aria-hidden="true" />
            ))}
          </ul>
        )}

        {status === 'error' && (
          <div className="public-catalog__message">
            <p>No pudimos cargar el catálogo en este momento.</p>
            <button type="button" onClick={reload}>
              Reintentar
            </button>
          </div>
        )}

        {status === 'success' && products.length === 0 && (
          <div className="public-catalog__message">
            <p>
              {hasFilters
                ? 'Ningún producto coincide con estos filtros.'
                : 'Estamos actualizando el catálogo. Vuelve pronto.'}
            </p>
            {hasFilters && (
              <button type="button" onClick={clearFilters}>
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {status === 'success' && products.length > 0 && (
          <ul className="public-catalog__grid" aria-label="Productos">
            {products.map((product) => (
              <CatalogProductCard key={product.productId} product={product} />
            ))}
          </ul>
        )}

        {status === 'success' && meta && meta.totalPages > 1 && (
          <nav className="public-catalog__pages" aria-label="Paginación del catálogo">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => update({ pagina: page > 2 ? String(page - 1) : undefined })}
            >
              Anterior
            </button>
            <span>
              Página {page} de {meta.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => update({ pagina: String(page + 1) })}
            >
              Siguiente
            </button>
          </nav>
        )}
      </main>
    </PublicLayout>
  )
}

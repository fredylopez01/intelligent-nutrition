import { useEffect, useState } from 'react'

import { useAuth } from '../../hooks/useAuth'
import { productsService } from '../../services/products.service'
import type { Product } from '../../types/product'
import type { SupplySourceProduct } from '../../types/supply'
import { Alert } from '../ui/Alert'
import { SearchBar } from '../ui/SearchBar'

import '../inventory/AssignProductForm.css'

const RESULTS_LIMIT = 6

interface SearchResult {
  key: string
  products: Product[]
  error: string | null
}

interface SupplyProductPickerProps {
  id: string
  selected: SupplySourceProduct | null
  onSelect: (product: SupplySourceProduct | null) => void
  disabled?: boolean
  error?: string
}

export function SupplyProductPicker({
  id,
  selected,
  onSelect,
  disabled = false,
  error,
}: SupplyProductPickerProps) {
  const { token } = useAuth()
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState<SearchResult | null>(null)
  const searchKey = `${term}|${token ?? ''}`
  const isSearching = selected === null

  useEffect(() => {
    if (!isSearching) return
    let cancelled = false
    productsService
      .list({ page: 1, limit: RESULTS_LIMIT, search: term || undefined, active: true }, token)
      .then((response) => {
        if (!cancelled) setSearch({ key: searchKey, products: response.data, error: null })
      })
      .catch(() => {
        if (cancelled) return
        setSearch({
          key: searchKey,
          products: [],
          error: 'No fue posible buscar productos. Intenta de nuevo.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [isSearching, searchKey, term, token])

  const current = search?.key === searchKey ? search : null

  return (
    <div className="assign-form__step">
      {selected ? (
        <div className="assign-form__selected">
          <div className="assign-form__selected-info">
            <span className="assign-form__product-name">{selected.name}</span>
            {selected.referenceCode && (
              <span className="assign-form__product-meta">{selected.referenceCode}</span>
            )}
          </div>
          <button
            type="button"
            className="assign-form__change"
            onClick={() => onSelect(null)}
            disabled={disabled}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <SearchBar
            id={id}
            label="Buscar producto del catálogo por nombre o código"
            placeholder="Buscar producto por nombre o código"
            value={term}
            onSearch={setTerm}
            embedded
          />
          {!current && (
            <p className="assign-form__hint" role="status">
              Buscando productos...
            </p>
          )}
          {current?.error && <Alert tone="error">{current.error}</Alert>}
          {current && !current.error && current.products.length === 0 && (
            <p className="assign-form__hint" role="status">
              {term
                ? `Ningún producto activo coincide con "${term}".`
                : 'No hay productos activos en el catálogo.'}
            </p>
          )}
          {current && current.products.length > 0 && (
            <ul className="assign-form__results" aria-label="Productos del catálogo">
              {current.products.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    className="assign-form__result"
                    disabled={disabled}
                    onClick={() =>
                      onSelect({
                        id: product.id,
                        name: product.name,
                        referenceCode: product.referenceCode,
                      })
                    }
                  >
                    <span className="assign-form__product-name">{product.name}</span>
                    <span className="assign-form__product-meta">
                      {product.referenceCode} · {product.category.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && (
        <p className="assign-form__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

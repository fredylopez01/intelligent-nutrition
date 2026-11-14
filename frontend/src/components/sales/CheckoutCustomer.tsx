import { useState } from 'react'

import { useAuth } from '../../hooks/useAuth'
import { customersService } from '../../services/customers.service'
import type { Customer } from '../../types/customer'
import { getCustomerDocument, resolveCustomerError } from '../../utils/customers'
import { CreateCustomerForm } from '../customers/CreateCustomerForm'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { SearchBar } from '../ui/SearchBar'

import './CheckoutCustomer.css'

type Mode = 'search' | 'create'

interface CheckoutCustomerProps {
  customer: Customer | null
  onChange: (customer: Customer | null) => void
}

export function CheckoutCustomer({ customer, onChange }: CheckoutCustomerProps) {
  const { token } = useAuth()
  const [mode, setMode] = useState<Mode>('search')
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Customer[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async (value: string) => {
    setTerm(value)
    setLoading(true)
    setError(null)
    try {
      const response = await customersService.list(
        { page: 1, limit: 5, search: value, active: true },
        token,
      )
      setResults(response.data)
    } catch (caught) {
      setResults(null)
      setError(resolveCustomerError(caught, 'No fue posible buscar clientes. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  if (customer) {
    return (
      <div className="checkout-customer__selected">
        <div>
          <p className="checkout-customer__name">{customer.fullName}</p>
          <p className="checkout-customer__meta">
            {getCustomerDocument(customer)} · {customer.person.email}
          </p>
          <p className="checkout-customer__meta">
            {customer.person.phone} · {customer.person.address}
          </p>
        </div>
        <Button variant="ghost" onClick={() => onChange(null)}>
          Cambiar cliente
        </Button>
      </div>
    )
  }

  if (mode === 'create') {
    return (
      <div className="checkout-customer__create">
        <CreateCustomerForm
          onCreated={(created) => {
            onChange(created)
            setMode('search')
          }}
          onCancel={() => setMode('search')}
        />
      </div>
    )
  }

  return (
    <div className="checkout-customer">
      <SearchBar
        id="checkout-customer-search"
        label="Buscar cliente por nombre o documento"
        placeholder="Nombre o número de documento"
        value={term}
        onSearch={(value) => void search(value)}
      />
      {error && <Alert tone="error">{error}</Alert>}
      {loading && (
        <p className="checkout-customer__hint" role="status">
          Buscando clientes...
        </p>
      )}
      {!loading && results !== null && results.length === 0 && (
        <p className="checkout-customer__hint">Ningún cliente coincide con «{term}».</p>
      )}
      {!loading && results && results.length > 0 && (
        <ul className="checkout-customer__results" aria-label="Clientes encontrados">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="checkout-customer__result"
                onClick={() => onChange(item)}
              >
                <span className="checkout-customer__name">{item.fullName}</span>
                <span className="checkout-customer__meta">{getCustomerDocument(item)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="checkout-customer__new" onClick={() => setMode('create')}>
        Registrar un cliente nuevo
      </button>
    </div>
  )
}

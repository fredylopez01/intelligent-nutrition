import { useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../../hooks/useAuth'
import type { InventoryBranchOption } from '../../hooks/useInventoryBranches'
import { supplyPurchasesService } from '../../services/supplyPurchases.service'
import type { SupplyPurchase } from '../../types/supplyPurchase'
import {
  formatSupplyQuantity,
  parseQuantity,
  resolveSupplyPurchaseError,
} from '../../utils/supplyPurchases'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

import './SupplyPurchases.css'

interface SupplyReceiptFormProps {
  purchase: SupplyPurchase
  branches: InventoryBranchOption[]
  onReceived: (purchase: SupplyPurchase) => void
  onCancel: () => void
}

export function SupplyReceiptForm({
  purchase,
  branches,
  onReceived,
  onCancel,
}: SupplyReceiptFormProps) {
  const { token } = useAuth()
  const pendingItems = purchase.items.filter((item) => item.pendingQuantity > 0)
  const activeBranches = branches.filter((branch) => branch.active)
  const [branchId, setBranchId] = useState(activeBranches.length === 1 ? activeBranches[0].id : '')
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(pendingItems.map((item) => [item.id, String(item.pendingQuantity)])),
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const lines = pendingItems.flatMap((item) => {
    const raw = quantities[item.id]?.trim() ?? ''
    if (!raw || raw === '0') return []
    return [{ item, quantity: parseQuantity(raw) }]
  })

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!branchId) {
      setError('Elige la sede que recibe los insumos.')
      return
    }
    if (lines.length === 0) {
      setError('Escribe la cantidad recibida de al menos un insumo.')
      return
    }
    const invalid = lines.find(
      ({ item, quantity }) => quantity === null || quantity > item.pendingQuantity,
    )
    if (invalid) {
      setError(
        `La cantidad de ${invalid.item.supply.name} debe ser mayor que 0 y no superar ${formatSupplyQuantity(invalid.item.pendingQuantity, invalid.item.supply.unit)}.`,
      )
      return
    }
    setSubmitting(true)
    try {
      const updated = await supplyPurchasesService.receive(
        purchase.id,
        {
          branchId,
          items: lines.map(({ item, quantity }) => ({
            detailId: item.id,
            quantity: quantity ?? 0,
          })),
        },
        token,
      )
      onReceived(updated)
    } catch (caught) {
      setError(resolveSupplyPurchaseError(caught, 'No fue posible registrar la recepción.'))
      setSubmitting(false)
    }
  }

  return (
    <form className="supply-purchase-form" onSubmit={submit} noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="ui-field">
        <label className="ui-field__label" htmlFor="supply-receipt-branch">
          Sede que recibe
        </label>
        <select
          id="supply-receipt-branch"
          className="ui-field__control"
          value={branchId}
          onChange={(event) => setBranchId(event.target.value)}
        >
          <option value="">Elige la sede</option>
          {activeBranches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>
      <ul className="supply-receipt__lines">
        {pendingItems.map((item) => (
          <li key={item.id} className="supply-receipt__line">
            <span>
              <span className="supply-receipt__name">{item.supply.name}</span>
              <span className="supply-receipt__meta">
                Pendiente: {formatSupplyQuantity(item.pendingQuantity, item.supply.unit)}
              </span>
            </span>
            <input
              className="ui-field__control"
              inputMode="decimal"
              aria-label={`Cantidad recibida de ${item.supply.name}`}
              value={quantities[item.id] ?? ''}
              onChange={(event) =>
                setQuantities((previous) => ({ ...previous, [item.id]: event.target.value }))
              }
            />
          </li>
        ))}
      </ul>
      <p className="supply-receipt__hint">
        Lo recibido se suma al stock de insumos de la sede y queda como entrada en sus movimientos.
        Deja en 0 lo que todavía no llega.
      </p>
      <div className="supply-purchase-form__actions">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Volver
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Registrando...' : 'Registrar recepción'}
        </Button>
      </div>
    </form>
  )
}

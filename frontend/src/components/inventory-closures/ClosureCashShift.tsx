import { Link } from 'react-router-dom'

import type { CashShift } from '../../types/cashShift'
import { formatMovementDate } from '../../utils/inventoryMovements'
import { formatPrice } from '../../utils/products'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

import './InventoryClosures.css'

interface ClosureCashShiftProps {
  status: 'idle' | 'loading' | 'success' | 'error'
  shift: CashShift | null
  branchName: string
  canOpenShift: boolean
  onRetry: () => void
}

export function ClosureCashShift({
  status,
  shift,
  branchName,
  canOpenShift,
  onRetry,
}: ClosureCashShiftProps) {
  if (status === 'idle' || status === 'loading') {
    return (
      <p className="closure-shift closure-shift--loading" role="status">
        Revisando el turno de caja de {branchName}...
      </p>
    )
  }
  if (status === 'error') {
    return (
      <div className="closure-shift closure-shift--error">
        <Alert tone="error">No fue posible revisar el turno de caja de la sede.</Alert>
        <Button variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    )
  }
  if (!shift) {
    return (
      <div className="closure-shift closure-shift--missing" role="status">
        <p className="closure-shift__title">No hay un turno de caja abierto en {branchName}</p>
        <p className="closure-shift__text">
          Puedes contar y guardar, pero para confirmar el cierre alguien de la sede debe abrir su
          turno de caja.
        </p>
        {canOpenShift && (
          <Link className="closure-shift__link" to="/caja/turno">
            Abrir turno en Caja
          </Link>
        )}
      </div>
    )
  }
  return (
    <section className="closure-shift" aria-label="Turno de caja activo">
      <p className="closure-card__eyebrow">Turno de caja activo</p>
      <p className="closure-shift__title">
        {shift.user.fullName ? `Turno de ${shift.user.fullName}` : 'Turno abierto'}
      </p>
      <p className="closure-shift__text">
        Abierto el {formatMovementDate(shift.openedAt)} · Base {formatPrice(shift.openingAmount)}.
        Al confirmar, el cierre queda ligado a este turno.
      </p>
    </section>
  )
}

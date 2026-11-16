import type { ClosureSupplyItem, InventoryClosure } from '../../types/inventoryClosure'
import { formatExpirationDate, formatQuantity } from '../../utils/inventory'
import {
  differenceLabel,
  formatClosureDay,
  lotKey,
  supplyDifferenceLabel,
} from '../../utils/inventoryClosures'
import { formatMovementDate } from '../../utils/inventoryMovements'
import { formatSupplyQuantity } from '../../utils/supplies'

import './InventoryClosures.css'

interface ClosureResultProps {
  closure: InventoryClosure
  showDifferences: boolean
}

function SupplyResults({
  items,
  showDifferences,
}: {
  items: ClosureSupplyItem[]
  showDifferences: boolean
}) {
  return (
    <div className="closure-result__table-wrap">
      <table className="closure-result__table">
        <caption className="sr-only">
          {showDifferences ? 'Diferencias de los insumos' : 'Conteo físico de los insumos'}
        </caption>
        <thead>
          <tr>
            <th scope="col">Insumo</th>
            <th scope="col" className="closure-result__number">
              {showDifferences ? 'Sistema' : 'Esperado'}
            </th>
            <th scope="col" className="closure-result__number">
              Contado
            </th>
            {showDifferences && (
              <th scope="col" className="closure-result__number">
                Diferencia
              </th>
            )}
            <th scope="col" className="closure-result__note">
              Observación
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const difference = showDifferences ? Number(item.difference ?? 0) : 0
            const tone =
              !showDifferences || item.difference === null || difference === 0
                ? ''
                : difference < 0
                  ? ' closure-result__row--negative'
                  : ' closure-result__row--positive'
            return (
              <tr key={item.supplyId} className={`closure-result__row${tone}`}>
                <td>
                  <span className="closure-count__name">{item.supplyName}</span>
                  <span className="closure-count__meta">Insumo</span>
                </td>
                <td className="closure-result__number">
                  {formatSupplyQuantity(item.systemQuantity, item.unit)}
                </td>
                <td className="closure-result__number">
                  {item.physicalQuantity === null
                    ? 'Sin contar'
                    : formatSupplyQuantity(item.physicalQuantity, item.unit)}
                </td>
                {showDifferences && (
                  <td className="closure-result__number closure-result__difference">
                    {supplyDifferenceLabel(item.difference, item.unit)}
                  </td>
                )}
                <td className="closure-result__note">{item.observation || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ClosureResult({ closure, showDifferences }: ClosureResultProps) {
  const counted = closure.items.filter((item) => item.physicalQuantity !== null).length
  const withDifference = closure.items.filter(
    (item) => item.difference !== null && item.difference !== undefined && item.difference !== 0,
  )
  const missingUnits = withDifference
    .filter((item) => (item.difference ?? 0) < 0)
    .reduce((sum, item) => sum + Math.abs(item.difference ?? 0), 0)
  const extraUnits = withDifference
    .filter((item) => (item.difference ?? 0) > 0)
    .reduce((sum, item) => sum + (item.difference ?? 0), 0)
  const supplyItems = closure.supplyItems ?? []
  const suppliesWithDifference = supplyItems.filter(
    (item) =>
      item.difference !== null && item.difference !== undefined && Number(item.difference) !== 0,
  ).length

  return (
    <div className="closure-result">
      <div
        className={`closure-result__banner closure-result__banner--${closure.status.toLowerCase()}`}
      >
        <p className="closure-result__banner-title">
          {closure.status === 'CONFIRMED'
            ? `Cierre del ${formatClosureDay(closure.closureDate)} confirmado`
            : `Cierre del ${formatClosureDay(closure.closureDate)} sin confirmar`}
        </p>
        <p className="closure-result__banner-text">
          {closure.status === 'CONFIRMED'
            ? [
                closure.closedAt
                  ? `Se confirmó el ${formatMovementDate(closure.closedAt)}`
                  : 'Se confirmó',
                closure.userName ? `Lo inició ${closure.userName}` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Nadie lo confirmó antes de la medianoche y el sistema lo bloqueó. Las diferencias se calcularon solo con los lotes que alcanzaron a contarse.'}
        </p>
      </div>

      {showDifferences ? (
        <>
          <dl className="closure-result__stats">
            <div>
              <dt>Lotes contados</dt>
              <dd>
                {counted} de {closure.items.length}
              </dd>
            </div>
            <div>
              <dt>Con diferencia</dt>
              <dd>{withDifference.length}</dd>
            </div>
            <div>
              <dt>Unidades faltantes</dt>
              <dd className={missingUnits > 0 ? 'closure-result__negative' : undefined}>
                {missingUnits}
              </dd>
            </div>
            <div>
              <dt>Unidades sobrantes</dt>
              <dd className={extraUnits > 0 ? 'closure-result__positive' : undefined}>
                {extraUnits}
              </dd>
            </div>
            {supplyItems.length > 0 && (
              <div>
                <dt>Insumos con diferencia</dt>
                <dd>
                  {suppliesWithDifference} de {supplyItems.length}
                </dd>
              </div>
            )}
          </dl>

          <div className="closure-result__table-wrap">
            <table className="closure-result__table">
              <caption className="sr-only">Diferencias entre el sistema y el conteo físico</caption>
              <thead>
                <tr>
                  <th scope="col">Producto y lote</th>
                  <th scope="col" className="closure-result__number">
                    Sistema
                  </th>
                  <th scope="col" className="closure-result__number">
                    Contado
                  </th>
                  <th scope="col" className="closure-result__number">
                    Diferencia
                  </th>
                  <th scope="col" className="closure-result__note">
                    Observación
                  </th>
                </tr>
              </thead>
              <tbody>
                {closure.items.map((item) => {
                  const difference = item.difference ?? null
                  const tone =
                    difference === null || difference === 0
                      ? ''
                      : difference < 0
                        ? ' closure-result__row--negative'
                        : ' closure-result__row--positive'
                  return (
                    <tr key={lotKey(item)} className={`closure-result__row${tone}`}>
                      <td>
                        <span className="closure-count__name">{item.productName}</span>
                        <span className="closure-count__meta">
                          {item.expirationDate
                            ? `Vence ${formatExpirationDate(item.expirationDate)}`
                            : 'Sin lote'}
                        </span>
                      </td>
                      <td className="closure-result__number">
                        {formatQuantity(item.systemQuantity ?? 0, item.unit)}
                      </td>
                      <td className="closure-result__number">
                        {item.physicalQuantity === null
                          ? 'Sin contar'
                          : formatQuantity(item.physicalQuantity, item.unit)}
                      </td>
                      <td className="closure-result__number closure-result__difference">
                        {differenceLabel(difference, item.unit)}
                      </td>
                      <td className="closure-result__note">{item.observation || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {supplyItems.length > 0 && <SupplyResults items={supplyItems} showDifferences />}
          <p className="closure-count__hint">
            El cierre no corrige el stock: si una diferencia es real, el superadmin la registra como
            un ajuste en Movimientos, y la sede ajusta los insumos en Inventario › Insumos.
          </p>
        </>
      ) : (
        <>
          <div className="closure-result__table-wrap">
            <table className="closure-result__table">
              <caption className="sr-only">Conteo físico registrado</caption>
              <thead>
                <tr>
                  <th scope="col">Producto y lote</th>
                  <th scope="col" className="closure-result__number">
                    Esperado
                  </th>
                  <th scope="col" className="closure-result__number">
                    Contado
                  </th>
                  <th scope="col" className="closure-result__note">
                    Observación
                  </th>
                </tr>
              </thead>
              <tbody>
                {closure.items.map((item) => (
                  <tr key={lotKey(item)} className="closure-result__row">
                    <td>
                      <span className="closure-count__name">{item.productName}</span>
                      <span className="closure-count__meta">
                        {item.expirationDate
                          ? `Vence ${formatExpirationDate(item.expirationDate)}`
                          : 'Sin lote'}
                      </span>
                    </td>
                    <td className="closure-result__number">
                      {item.systemQuantity === undefined
                        ? '—'
                        : formatQuantity(item.systemQuantity, item.unit)}
                    </td>
                    <td className="closure-result__number">
                      {item.physicalQuantity === null
                        ? 'Sin contar'
                        : formatQuantity(item.physicalQuantity, item.unit)}
                    </td>
                    <td className="closure-result__note">{item.observation || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {supplyItems.length > 0 && <SupplyResults items={supplyItems} showDifferences={false} />}
          <p className="closure-count__hint">
            El líder de la sede revisa las diferencias contra el sistema.
          </p>
        </>
      )}
    </div>
  )
}

import type { SupplyStockRow } from '../../types/supply'
import { formatSupplyQuantity, isSupplyLow, supplyQuantity } from '../../utils/supplies'
import { StockStatus } from '../inventory/StockStatus'
import { RowActions, type RowAction } from '../ui/RowActions'

import '../inventory/InventoryTable.css'
import './Supplies.css'

interface SupplyStockTableProps {
  rows: SupplyStockRow[]
  showBranch: boolean
  onMove?: (row: SupplyStockRow) => void
  onEditMinimum?: (row: SupplyStockRow) => void
}

export function SupplyStockTable({
  rows,
  showBranch,
  onMove,
  onEditMinimum,
}: SupplyStockTableProps) {
  const hasActions = Boolean(onMove || onEditMinimum)
  return (
    <table className="inventory-table supplies-table">
      <caption className="sr-only">Stock de insumos por sede</caption>
      <thead>
        <tr>
          <th scope="col">Insumo</th>
          {showBranch && (
            <th scope="col" className="supplies-table__col-branch">
              Sede
            </th>
          )}
          <th scope="col" className="inventory-table__col-number">
            Stock actual
          </th>
          <th scope="col" className="inventory-table__col-number inventory-table__col-minimum">
            Stock mínimo
          </th>
          <th scope="col" className="inventory-table__col-status">
            Estado
          </th>
          {hasActions && (
            <th scope="col" className="inventory-table__col-actions">
              <span className="sr-only">Acciones</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const unit = row.supply.unitOfMeasure.abbreviation
          const isLow = isSupplyLow(row)
          const actions: RowAction[] = []
          if (onMove)
            actions.push({ label: 'Registrar entrada o salida', onSelect: () => onMove(row) })
          if (onEditMinimum) {
            actions.push({ label: 'Cambiar stock mínimo', onSelect: () => onEditMinimum(row) })
          }
          return (
            <tr
              key={`${row.branchId}-${row.supplyId}`}
              className={`inventory-table__row${isLow ? ' inventory-table__row--low' : ''}`}
            >
              <td>
                <span className="inventory-table__identity">
                  <span className="inventory-table__name">{row.supply.name}</span>
                  <span className="inventory-table__reference supplies-table__inline">
                    {showBranch && row.branchName && (
                      <span className="supplies-table__inline-branch">{row.branchName}</span>
                    )}
                    <span className="supplies-table__inline-minimum">
                      Mínimo {formatSupplyQuantity(row.minimumQuantity, unit)}
                    </span>
                  </span>
                </span>
              </td>
              {showBranch && (
                <td className="supplies-table__col-branch inventory-table__muted">
                  {row.branchName ?? '—'}
                </td>
              )}
              <td className="inventory-table__col-number">
                <span className="inventory-table__quantity">
                  {formatSupplyQuantity(row.quantity)}
                </span>
                <span className="inventory-table__unit">{unit}</span>
              </td>
              <td className="inventory-table__col-number inventory-table__col-minimum inventory-table__muted">
                {formatSupplyQuantity(row.minimumQuantity, unit)}
              </td>
              <td className="inventory-table__col-status">
                <StockStatus totalQuantity={supplyQuantity(row.quantity)} lowStock={isLow} />
              </td>
              {hasActions && (
                <td className="inventory-table__col-actions">
                  <RowActions
                    label={`Acciones para ${row.supply.name}${showBranch && row.branchName ? ` en ${row.branchName}` : ''}`}
                    actions={actions}
                  />
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

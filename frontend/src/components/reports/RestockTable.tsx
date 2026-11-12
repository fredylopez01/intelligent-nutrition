import type { RestockReportRow } from '../../types/report'

import '../sales/Sales.css'
import './Reports.css'

interface RestockTableProps {
  rows: RestockReportRow[]
  showBranch: boolean
}

function units(value: number): string {
  return `${value} und`
}

export function RestockTable({ rows, showBranch }: RestockTableProps) {
  return (
    <table className="sales-table reports-table">
      <caption className="sr-only">
        Productos con stock por debajo del mínimo, del más urgente al menos urgente
      </caption>
      <thead>
        <tr>
          <th scope="col">Producto</th>
          {showBranch && <th scope="col">Sede</th>}
          <th scope="col" className="sales-table__number">
            Stock actual
          </th>
          <th scope="col" className="sales-table__number reports-table__col-average">
            Stock mínimo
          </th>
          <th scope="col" className="sales-table__number reports-table__col-average">
            Demanda 7 días
          </th>
          <th scope="col" className="sales-table__number">
            Reponer
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.productId}-${row.branchId}`}>
            <td>
              <span className="sales-table__number-code">{row.name}</span>
              <span className="sales-table__meta">
                {row.referenceCode}
                {showBranch && (
                  <span className="reports-table__inline-text"> · {row.branchName}</span>
                )}
              </span>
            </td>
            {showBranch && <td className="sales-table__muted">{row.branchName}</td>}
            <td className="sales-table__number">
              <span className="reports-table__deficit">{units(row.currentQuantity)}</span>
            </td>
            <td className="sales-table__number reports-table__col-average">
              {units(row.minimumStock)}
            </td>
            <td className="sales-table__number reports-table__col-average">
              {units(row.projectedDemand7d)}
            </td>
            <td className="sales-table__number reports-table__suggested">
              {units(row.suggestedUnits)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

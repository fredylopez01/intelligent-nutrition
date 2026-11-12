import type { SalesReportRow } from '../../types/report'
import { formatExpirationDate } from '../../utils/inventory'
import { formatPrice } from '../../utils/products'
import { toCents } from '../../utils/sales'

import '../sales/Sales.css'
import './Reports.css'

interface SalesReportTableProps {
  rows: SalesReportRow[]
  showBranch: boolean
}

export function SalesReportTable({ rows, showBranch }: SalesReportTableProps) {
  return (
    <table className="sales-table reports-table">
      <caption className="sr-only">Ventas por día, de la más reciente a la más antigua</caption>
      <thead>
        <tr>
          <th scope="col">Día</th>
          {showBranch && <th scope="col">Sede</th>}
          <th scope="col" className="sales-table__number">
            Ventas
          </th>
          <th scope="col" className="sales-table__number reports-table__col-average">
            Ticket promedio
          </th>
          <th scope="col" className="sales-table__number">
            Total vendido
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const totalCents = toCents(row.totalAmount)
          const average = row.salesCount > 0 ? Math.round(totalCents / row.salesCount) : 0
          return (
            <tr key={`${row.day}-${row.branch.id}`}>
              <td>
                <span className="sales-table__number-code">{formatExpirationDate(row.day)}</span>
                {showBranch && (
                  <span className="sales-table__meta reports-table__inline">{row.branch.name}</span>
                )}
              </td>
              {showBranch && <td className="sales-table__muted">{row.branch.name}</td>}
              <td className="sales-table__number">{row.salesCount}</td>
              <td className="sales-table__number reports-table__col-average">
                {formatPrice(average / 100)}
              </td>
              <td className="sales-table__number">{formatPrice(totalCents / 100)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

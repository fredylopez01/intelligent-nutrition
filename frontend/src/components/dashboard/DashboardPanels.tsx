import { Link } from 'react-router-dom'

import type { BranchDashboard } from '../../types/dashboard'
import {
  alertAction,
  alertDescription,
  averageTicket,
  formatChange,
  formatShare,
  isUrgentAlert,
  salesChange,
  salesShare,
  shortBranchName,
  weekdayLabel,
} from '../../utils/dashboard'
import { formatPrice } from '../../utils/products'

import './Dashboard.css'

const unitsFormatter = new Intl.NumberFormat('es-CO')

function plural(count: number, singular: string, pluralText: string): string {
  return `${unitsFormatter.format(count)} ${count === 1 ? singular : pluralText}`
}

export function SalesCard({ dashboard }: { dashboard: BranchDashboard }) {
  const { salesToday, salesYesterdayUntilNow, salesLast7Days, date } = dashboard
  const change = salesChange(salesToday.totalAmount, salesYesterdayUntilNow)
  const max = Math.max(1, ...salesLast7Days.map((day) => day.totalAmount))
  const details = [
    plural(salesToday.count, 'venta', 'ventas'),
    plural(dashboard.uniqueCustomersToday, 'cliente', 'clientes'),
    `${formatPrice(dashboard.monthlyRevenue)} en el mes`,
  ].join(' · ')

  return (
    <section className="dashboard-panel dashboard-sales" aria-labelledby="dashboard-sales-title">
      <div className="dashboard-panel__head">
        <h2 id="dashboard-sales-title" className="dashboard-panel__label">
          Ventas de hoy
        </h2>
        {change !== null && (
          <span
            className={`dashboard-change${change < 0 ? ' dashboard-change--down' : ''}`}
            title="Comparado con ayer a esta misma hora"
          >
            {formatChange(change)}
          </span>
        )}
      </div>
      <p className="dashboard-panel__value">{formatPrice(salesToday.totalAmount)}</p>
      <p className="dashboard-panel__hint">
        Ayer a esta hora: {formatPrice(salesYesterdayUntilNow)}
      </p>
      <p className="dashboard-panel__hint">{details}</p>
      <ol className="dashboard-bars" aria-label="Ventas de los últimos 7 días">
        {salesLast7Days.map((day) => {
          const isToday = day.date === date
          const label = weekdayLabel(day.date, date)
          const height = Math.max(4, Math.round((day.totalAmount / max) * 100))
          return (
            <li key={day.date} className="dashboard-bars__day">
              <span
                className={`dashboard-bars__bar${isToday ? ' dashboard-bars__bar--today' : ''}`}
                style={{ height: `${height}%` }}
                aria-hidden="true"
              />
              <span
                className={`dashboard-bars__label${isToday ? ' dashboard-bars__label--today' : ''}`}
              >
                {label}
              </span>
              <span className="sr-only">{formatPrice(day.totalAmount)}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function StockCard({ dashboard }: { dashboard: BranchDashboard }) {
  const { stock, branches, criticalStockProducts } = dashboard
  const where = dashboard.branch
    ? `unidades en ${shortBranchName(dashboard.branch.name)}`
    : `unidades en ${plural(branches.active, 'sede', 'sedes')}`
  const criticalScope = dashboard.branch ? '' : ' en alguna sede'
  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-stock-title">
      <h2 id="dashboard-stock-title" className="dashboard-panel__label">
        Stock total
      </h2>
      <p className="dashboard-panel__value">{unitsFormatter.format(stock.totalUnits)}</p>
      <p className="dashboard-panel__hint">{where}</p>
      <p
        className={`dashboard-panel__hint${criticalStockProducts > 0 ? ' dashboard-panel__hint--warning' : ''}`}
      >
        {criticalStockProducts === 0
          ? 'Ningún producto en stock crítico'
          : `${plural(criticalStockProducts, 'producto', 'productos')} con menos de 5 unidades${criticalScope}`}
      </p>
      {stock.byCategory.length > 0 && (
        <dl className="dashboard-panel__list">
          {stock.byCategory.map((category) => (
            <div key={category.categoryId} className="dashboard-panel__row">
              <dt>{category.name}</dt>
              <dd>{unitsFormatter.format(category.units)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function NoSales() {
  return (
    <>
      <span className="dashboard-branches__muted" aria-hidden="true">
        —
      </span>
      <span className="sr-only">Sin ventas</span>
    </>
  )
}

interface BranchesPanelProps {
  dashboard: BranchDashboard
  canUse: (path: string) => boolean
}

export function BranchesPanel({ dashboard, canUse }: BranchesPanelProps) {
  const { branches, salesToday, topBranch } = dashboard
  const rows = [...branches.items].sort(
    (a, b) => b.salesToday - a.salesToday || a.name.localeCompare(b.name, 'es'),
  )
  const lowStockTotal =
    dashboard.lowStockAlerts ?? rows.reduce((sum, branch) => sum + branch.lowStockProducts, 0)
  const totalTicket = averageTicket(salesToday.totalAmount, salesToday.count)
  const canSeeRestock = canUse('/reportes/reposicion')

  return (
    <section
      className="dashboard-panel dashboard-panel--list dashboard-branches"
      aria-labelledby="dashboard-branches-title"
    >
      <div className="dashboard-panel__header">
        <h2 id="dashboard-branches-title" className="dashboard-panel__title">
          Sedes hoy{' '}
          <span className="dashboard-panel__count">
            · {branches.open} de {branches.active} {branches.active === 1 ? 'abierta' : 'abiertas'}
          </span>
        </h2>
        {canUse('/reportes') && (
          <Link className="dashboard-panel__link" to="/reportes">
            Ver reporte de ventas
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="dashboard-panel__empty">No hay sedes activas para mostrar.</p>
      ) : (
        <div className="dashboard-branches__scroll">
          <table className="dashboard-branches__table">
            <caption className="sr-only">Ventas del día por sede</caption>
            <thead>
              <tr>
                <th scope="col">Sede</th>
                <th scope="col">Turno de caja</th>
                <th scope="col" className="dashboard-branches__numeric">
                  Ventas
                </th>
                <th scope="col" className="dashboard-branches__numeric dashboard-branches__ticket">
                  Ticket promedio
                </th>
                <th scope="col">Participación</th>
                <th scope="col" className="dashboard-branches__numeric">
                  Stock bajo
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((branch) => {
                const share = salesShare(branch.salesToday, salesToday.totalAmount)
                const ticket = averageTicket(branch.salesToday, branch.salesCount)
                const isTop = topBranch?.branchId === branch.branchId
                const shortName = shortBranchName(branch.name)
                return (
                  <tr key={branch.branchId} className="dashboard-branches__row">
                    <th scope="row" className="dashboard-branches__name" title={branch.name}>
                      <span className="dashboard-branches__label">{shortName}</span>
                      {isTop && <span className="dashboard-branches__tag">Líder del día</span>}
                    </th>
                    <td className="dashboard-branches__status">
                      <span
                        className={`dashboard-status${branch.open ? ' dashboard-status--open' : ''}`}
                      >
                        <span
                          className={`dashboard-dot${branch.open ? ' dashboard-dot--open' : ''}`}
                          aria-hidden="true"
                        />
                        {branch.open ? 'Abierta' : 'Sin turno'}
                      </span>
                    </td>
                    <td className="dashboard-branches__numeric dashboard-branches__sales">
                      <span className="dashboard-branches__amount">
                        {formatPrice(branch.salesToday)}
                      </span>
                      <span className="dashboard-branches__sub">
                        {plural(branch.salesCount, 'venta', 'ventas')}
                      </span>
                    </td>
                    <td className="dashboard-branches__numeric dashboard-branches__ticket">
                      {ticket === null ? <NoSales /> : formatPrice(ticket)}
                    </td>
                    <td className="dashboard-branches__share">
                      <span className="dashboard-branches__track" aria-hidden="true">
                        <span
                          className="dashboard-branches__fill"
                          style={{ width: `${Math.round(share)}%` }}
                        />
                      </span>
                      <span className="dashboard-branches__percent">{formatShare(share)}</span>
                    </td>
                    <td className="dashboard-branches__numeric dashboard-branches__stock">
                      <span className="dashboard-branches__cell-label" aria-hidden="true">
                        Stock bajo
                      </span>
                      {branch.lowStockProducts > 0 && canSeeRestock ? (
                        <Link
                          className="dashboard-branches__warning"
                          to={`/reportes/reposicion?sede=${branch.branchId}`}
                          aria-label={`${plural(branch.lowStockProducts, 'producto', 'productos')} bajo el mínimo en ${shortName}`}
                        >
                          {branch.lowStockProducts}
                        </Link>
                      ) : (
                        <span
                          className={
                            branch.lowStockProducts > 0
                              ? 'dashboard-branches__warning'
                              : 'dashboard-branches__muted'
                          }
                        >
                          {branch.lowStockProducts}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="dashboard-branches__row dashboard-branches__total">
                <th scope="row" className="dashboard-branches__name">
                  Total
                </th>
                <td className="dashboard-branches__status" />
                <td className="dashboard-branches__numeric dashboard-branches__sales">
                  <span className="dashboard-branches__amount">
                    {formatPrice(salesToday.totalAmount)}
                  </span>
                  <span className="dashboard-branches__sub">
                    {plural(salesToday.count, 'venta', 'ventas')}
                  </span>
                </td>
                <td className="dashboard-branches__numeric dashboard-branches__ticket">
                  {totalTicket === null ? <NoSales /> : formatPrice(totalTicket)}
                </td>
                <td className="dashboard-branches__share" />
                <td className="dashboard-branches__numeric dashboard-branches__stock">
                  <span className="dashboard-branches__cell-label" aria-hidden="true">
                    Stock bajo
                  </span>
                  <span
                    className={
                      lowStockTotal > 0
                        ? 'dashboard-branches__warning'
                        : 'dashboard-branches__muted'
                    }
                  >
                    {lowStockTotal}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}

interface AlertsPanelProps {
  dashboard: BranchDashboard
  inventoryLink: string | null
  canUse: (path: string) => boolean
}

export function AlertsPanel({ dashboard, inventoryLink, canUse }: AlertsPanelProps) {
  const { alerts, date } = dashboard
  return (
    <section
      className="dashboard-panel dashboard-panel--list"
      aria-labelledby="dashboard-alerts-title"
    >
      <div className="dashboard-panel__header">
        <h2 id="dashboard-alerts-title" className="dashboard-panel__title">
          Alertas de inventario
          {alerts.total > alerts.items.length && (
            <span className="dashboard-panel__count"> · {alerts.total}</span>
          )}
        </h2>
        {inventoryLink && (
          <Link className="dashboard-panel__link" to={inventoryLink}>
            Ver inventario
          </Link>
        )}
      </div>
      {alerts.items.length === 0 ? (
        <p className="dashboard-panel__empty">
          Todo el inventario está en nivel: no hay productos agotados, bajo el mínimo ni por vencer.
        </p>
      ) : (
        <ul className="dashboard-alerts">
          {alerts.items.map((alert) => {
            const action = alertAction(alert.type)
            const urgent = isUrgentAlert(alert.type)
            return (
              <li key={`${alert.type}-${alert.productId}`} className="dashboard-alerts__item">
                <span
                  className={`dashboard-alerts__dot${urgent ? ' dashboard-alerts__dot--urgent' : ''}`}
                  aria-hidden="true"
                />
                <div className="dashboard-alerts__text">
                  <p className="dashboard-alerts__name">{alert.productName}</p>
                  <p className="dashboard-alerts__detail">{alertDescription(alert, date)}</p>
                </div>
                <span
                  className={`dashboard-alerts__quantity${urgent ? ' dashboard-alerts__quantity--urgent' : ''}`}
                >
                  {alert.quantity} und
                </span>
                {canUse(action.to) && (
                  <Link
                    className="dashboard-alerts__action"
                    to={action.to}
                    aria-label={`${action.label}: ${alert.productName}`}
                  >
                    {action.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function TopProductsPanel({ dashboard }: { dashboard: BranchDashboard }) {
  const { topProducts } = dashboard
  const max = Math.max(1, ...topProducts.map((product) => product.quantity))
  return (
    <section
      className="dashboard-panel dashboard-panel--list"
      aria-labelledby="dashboard-top-title"
    >
      <div className="dashboard-panel__header">
        <h2 id="dashboard-top-title" className="dashboard-panel__title">
          Más vendidos hoy
        </h2>
      </div>
      {topProducts.length === 0 ? (
        <p className="dashboard-panel__empty">Todavía no hay ventas completadas hoy.</p>
      ) : (
        <ol className="dashboard-top">
          {topProducts.map((product) => (
            <li key={product.productId} className="dashboard-top__item">
              <div className="dashboard-top__row">
                <span className="dashboard-top__name">{product.name}</span>
                <span className="dashboard-top__units">
                  {product.quantity}
                  <span className="sr-only"> unidades</span>
                </span>
              </div>
              <span className="dashboard-top__track" aria-hidden="true">
                <span
                  className="dashboard-top__fill"
                  style={{ width: `${Math.round((product.quantity / max) * 100)}%` }}
                />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

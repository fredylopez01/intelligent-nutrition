import { Link } from 'react-router-dom'

import type { BranchDashboard } from '../../types/dashboard'
import {
  alertAction,
  alertDescription,
  formatChange,
  isUrgentAlert,
  salesChange,
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
          : `${plural(criticalStockProducts, 'producto', 'productos')} con menos de 5 unidades`}
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

export function BranchesCard({ dashboard }: { dashboard: BranchDashboard }) {
  const { branches } = dashboard
  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-branches-title">
      <h2 id="dashboard-branches-title" className="dashboard-panel__label">
        {dashboard.branch ? 'Sede' : 'Sedes'}
      </h2>
      <p className="dashboard-panel__value">
        {branches.open} / {branches.active}
      </p>
      <p className="dashboard-panel__hint">
        {branches.active === 1 ? 'abierta ahora' : 'abiertas ahora'}, con turno de caja
      </p>
      <dl className="dashboard-panel__list">
        {[...branches.items]
          .sort((a, b) => b.salesToday - a.salesToday || a.name.localeCompare(b.name, 'es'))
          .map((branch) => (
            <div key={branch.branchId} className="dashboard-panel__row">
              <dt>
                <span
                  className={`dashboard-dot${branch.open ? ' dashboard-dot--open' : ''}`}
                  aria-hidden="true"
                />
                {shortBranchName(branch.name)}
                <span className="sr-only">{branch.open ? ' (abierta)' : ' (sin turno)'}</span>
              </dt>
              <dd>{formatPrice(branch.salesToday)}</dd>
            </div>
          ))}
      </dl>
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

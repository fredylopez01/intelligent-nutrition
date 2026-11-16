import type { OnlineOrder } from '../../types/onlineOrder'
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  formatOrderDate,
  holdLabel,
} from '../../utils/onlineOrders'
import { formatPrice } from '../../utils/products'

import '../users/StatusBadge.css'
import './OnlineOrders.css'

interface OnlineOrdersTableProps {
  orders: OnlineOrder[]
  showBranch: boolean
  onView: (order: OnlineOrder) => void
}

export function OnlineOrdersTable({ orders, showBranch, onView }: OnlineOrdersTableProps) {
  const now = new Date()
  return (
    <div className="orders-table__wrap">
      <table className="orders-table">
        <caption className="sr-only">Pedidos web</caption>
        <thead>
          <tr>
            <th scope="col">Pedido</th>
            <th scope="col">Cliente</th>
            <th scope="col">Entrega</th>
            {showBranch && <th scope="col">Sede</th>}
            <th scope="col" className="orders-table__number">
              Total
            </th>
            <th scope="col">Estado</th>
            <th scope="col">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <span className="orders-table__code">{order.code}</span>
                <span className="orders-table__meta">{formatOrderDate(order.createdAt)}</span>
              </td>
              <td>
                <span className="orders-table__name">{order.customer.name}</span>
                <span className="orders-table__meta">{order.customer.phone}</span>
              </td>
              <td>
                <span>{FULFILLMENT_LABELS[order.fulfillment]}</span>
                {order.delivery?.neighborhood && (
                  <span className="orders-table__meta">{order.delivery.neighborhood}</span>
                )}
              </td>
              {showBranch && <td className="orders-table__muted">{order.branch.name}</td>}
              <td className="orders-table__number">{formatPrice(order.subtotal)}</td>
              <td>
                <span className={`ui-status ui-status--${ORDER_STATUS_TONES[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
                {holdLabel(order, now) && (
                  <span className="orders-table__meta">{holdLabel(order, now)}</span>
                )}
              </td>
              <td className="orders-table__action">
                <button
                  type="button"
                  className="orders-table__view"
                  aria-label={`Ver el pedido ${order.code}`}
                  onClick={() => onView(order)}
                >
                  Ver
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

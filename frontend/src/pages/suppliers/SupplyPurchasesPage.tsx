import { useState } from 'react'

import { SupplyPurchaseForm } from '../../components/supply-purchases/SupplyPurchaseForm'
import { SupplyReceiptForm } from '../../components/supply-purchases/SupplyReceiptForm'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { ReloadButton } from '../../components/ui/ReloadButton'
import { SearchBar } from '../../components/ui/SearchBar'
import { TableSkeleton } from '../../components/ui/TableSkeleton'
import { useInventoryBranches } from '../../hooks/useInventoryBranches'
import { usePagination } from '../../hooks/usePagination'
import { useSupplierOptions } from '../../hooks/useSupplierOptions'
import { useSupplyPurchases } from '../../hooks/useSupplyPurchases'
import { AppLayout } from '../../layouts/AppLayout'
import type { SupplyPurchase, SupplyPurchaseStatus } from '../../types/supplyPurchase'
import { formatMovementDate } from '../../utils/inventoryMovements'
import { formatPrice } from '../../utils/products'
import {
  SUPPLY_PURCHASE_STATUS_LABELS,
  SUPPLY_PURCHASE_STATUS_TONES,
  formatSupplyQuantity,
} from '../../utils/supplyPurchases'

import '../inventory/InventoryPage.css'
import '../inventory/MovementsPage.css'
import '../../components/online-orders/OnlineOrders.css'
import '../../components/supply-purchases/SupplyPurchases.css'
import '../../components/users/StatusBadge.css'

const FILTER_DEFAULTS = { estado: 'todos' }
const STATUS_OPTIONS = Object.keys(SUPPLY_PURCHASE_STATUS_LABELS) as SupplyPurchaseStatus[]

function PurchaseDetail({
  purchase,
  onReceive,
  onClose,
}: {
  purchase: SupplyPurchase
  onReceive: () => void
  onClose: () => void
}) {
  return (
    <div className="supply-purchase-detail">
      <div className="order-detail__head">
        <div>
          <p className="order-detail__code">{purchase.purchaseNumber}</p>
          <p className="supply-purchase-detail__meta">
            {formatMovementDate(purchase.purchaseAt)} · {purchase.supplier.name} · Registró{' '}
            {purchase.user.fullName}
          </p>
        </div>
        <span className={`ui-status ui-status--${SUPPLY_PURCHASE_STATUS_TONES[purchase.status]}`}>
          {SUPPLY_PURCHASE_STATUS_LABELS[purchase.status]}
        </span>
      </div>
      {purchase.observation && (
        <p className="supply-purchase-detail__meta">{purchase.observation}</p>
      )}
      <table className="order-detail__items">
        <caption className="sr-only">Insumos de la compra</caption>
        <thead>
          <tr>
            <th scope="col">Insumo</th>
            <th scope="col" className="orders-table__number">
              Pedido
            </th>
            <th scope="col" className="orders-table__number">
              Recibido
            </th>
            <th scope="col" className="orders-table__number">
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          {purchase.items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.supply.name}
                <span className="orders-table__meta">
                  {formatPrice(item.unitCost)} por {item.supply.unit}
                </span>
              </td>
              <td className="orders-table__number">
                {formatSupplyQuantity(item.requestedQuantity, item.supply.unit)}
              </td>
              <td className="orders-table__number">
                {formatSupplyQuantity(item.receivedQuantity, item.supply.unit)}
              </td>
              <td className="orders-table__number">{formatPrice(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              Total
            </th>
            <td className="orders-table__number">{formatPrice(purchase.total)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="supply-purchase-form__actions">
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        {purchase.status !== 'FULLY_RECEIVED' && (
          <Button onClick={onReceive}>Recibir insumos</Button>
        )}
      </div>
    </div>
  )
}

export function SupplyPurchasesPage() {
  const { search, filters, params, limitOptions, setPage, setLimit, applySearch, setFilter } =
    usePagination({ filters: FILTER_DEFAULTS, defaultLimit: 20 })
  const suppliers = useSupplierOptions()
  const branches = useInventoryBranches()
  const { status, purchases, meta, error, refetch } = useSupplyPurchases({
    ...params,
    status: filters.estado === 'todos' ? undefined : (filters.estado as SupplyPurchaseStatus),
  })
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<SupplyPurchase | null>(null)
  const [receiving, setReceiving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const closeDetail = () => {
    setViewing(null)
    setReceiving(false)
  }

  const renderList = () => {
    if (status === 'loading')
      return <TableSkeleton label="Cargando compras..." rows={6} columns={5} />
    if (status === 'error') {
      return (
        <div className="inventory-page__feedback inventory-page__feedback--inset">
          <Alert tone="error">{error}</Alert>
          <Button variant="outline" onClick={refetch}>
            Reintentar
          </Button>
        </div>
      )
    }
    if (purchases.length === 0) {
      return (
        <EmptyState
          variant={search || filters.estado !== 'todos' ? 'sin-resultados' : 'sin-registros'}
          title={
            search || filters.estado !== 'todos'
              ? 'Ninguna compra coincide con los filtros'
              : 'Todavía no hay compras de insumos'
          }
          description="Registra lo que le compras a tus proveedores (leche, proteína a granel...) y recíbelo en la sede para sumarlo al stock de insumos."
        />
      )
    }
    return (
      <div className="orders-table__wrap">
        <table className="orders-table">
          <caption className="sr-only">Compras de insumos</caption>
          <thead>
            <tr>
              <th scope="col">Compra</th>
              <th scope="col">Proveedor</th>
              <th scope="col">Insumos</th>
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
            {purchases.map((purchase) => (
              <tr key={purchase.id}>
                <td>
                  <span className="orders-table__code">{purchase.purchaseNumber}</span>
                  <span className="orders-table__meta">
                    {formatMovementDate(purchase.purchaseAt)}
                  </span>
                </td>
                <td>{purchase.supplier.name}</td>
                <td className="orders-table__muted">
                  {purchase.items.map((item) => item.supply.name).join(', ')}
                </td>
                <td className="orders-table__number">{formatPrice(purchase.total)}</td>
                <td>
                  <span
                    className={`ui-status ui-status--${SUPPLY_PURCHASE_STATUS_TONES[purchase.status]}`}
                  >
                    {SUPPLY_PURCHASE_STATUS_LABELS[purchase.status]}
                  </span>
                </td>
                <td className="orders-table__action">
                  <button
                    type="button"
                    className="orders-table__view"
                    aria-label={`Ver la compra ${purchase.purchaseNumber}`}
                    onClick={() => {
                      setFeedback(null)
                      setViewing(purchase)
                    }}
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

  return (
    <AppLayout title="Compras de insumos">
      <div className="inventory-page__toolbar">
        <SearchBar
          id="supply-purchases-search"
          label="Buscar por número de compra"
          placeholder="Número, ej. CI-20261116"
          value={search}
          onSearch={(term) => (term === search ? refetch() : applySearch(term))}
        />
        <label className="sr-only" htmlFor="supply-purchases-status">
          Filtrar por estado
        </label>
        <select
          id="supply-purchases-status"
          className="inventory-page__filter"
          value={filters.estado}
          onChange={(event) => setFilter('estado', event.target.value)}
        >
          <option value="todos">Todos los estados</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {SUPPLY_PURCHASE_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
        <ReloadButton onReload={refetch} loading={status === 'loading'} />
        <Button
          onClick={() => {
            setFeedback(null)
            setCreating(true)
          }}
        >
          Nueva compra de insumos
        </Button>
      </div>

      {feedback && (
        <div className="inventory-page__feedback">
          <Alert tone="success">{feedback}</Alert>
        </div>
      )}

      <div className="inventory-page__card">{renderList()}</div>

      <div className="inventory-page__footer">
        {status === 'success' && meta && meta.total > 0 && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={params.limit}
            limitOptions={limitOptions}
            label="Paginación de compras de insumos"
            onChange={setPage}
            onLimitChange={setLimit}
          />
        )}
      </div>

      <Modal
        open={creating}
        title="Nueva compra de insumos"
        description="La cantidad va en la unidad de cada insumo (gramos, mililitros...)."
        size="wide"
        onClose={() => setCreating(false)}
      >
        {creating && (
          <SupplyPurchaseForm
            suppliers={suppliers.suppliers}
            onCreated={(purchase) => {
              setCreating(false)
              setFeedback(
                `La compra ${purchase.purchaseNumber} quedó registrada. Recíbela cuando lleguen los insumos.`,
              )
              refetch()
            }}
            onCancel={() => setCreating(false)}
          />
        )}
      </Modal>

      <Modal
        open={viewing !== null}
        title={viewing ? `Compra ${viewing.purchaseNumber}` : 'Compra'}
        size="wide"
        onClose={closeDetail}
      >
        {viewing &&
          (receiving ? (
            <SupplyReceiptForm
              purchase={viewing}
              branches={branches.branches}
              onReceived={(updated) => {
                closeDetail()
                setFeedback(
                  `Se registró la recepción de la compra ${updated.purchaseNumber}. El stock de insumos ya está actualizado.`,
                )
                refetch()
              }}
              onCancel={() => setReceiving(false)}
            />
          ) : (
            <PurchaseDetail
              purchase={viewing}
              onReceive={() => setReceiving(true)}
              onClose={closeDetail}
            />
          ))}
      </Modal>
    </AppLayout>
  )
}

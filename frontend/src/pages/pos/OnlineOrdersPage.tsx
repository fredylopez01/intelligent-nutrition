import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { OnlineOrderDetail } from '../../components/online-orders/OnlineOrderDetail'
import { OnlineOrdersTable } from '../../components/online-orders/OnlineOrdersTable'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { ReloadButton } from '../../components/ui/ReloadButton'
import { SearchBar } from '../../components/ui/SearchBar'
import { TableSkeleton } from '../../components/ui/TableSkeleton'
import { useAuth } from '../../hooks/useAuth'
import { useInventoryBranches } from '../../hooks/useInventoryBranches'
import { useOnlineOrders } from '../../hooks/useOnlineOrders'
import { usePagination } from '../../hooks/usePagination'
import { AppLayout } from '../../layouts/AppLayout'
import type {
  OnlineOrder,
  OnlineOrderFulfillment,
  OnlineOrderStatus,
} from '../../types/onlineOrder'
import { FULFILLMENT_LABELS, ORDER_STATUS_LABELS } from '../../utils/onlineOrders'

import '../inventory/InventoryPage.css'
import '../inventory/MovementsPage.css'
import '../../components/online-orders/OnlineOrders.css'

const ALL_BRANCHES = 'todas'
const FILTER_DEFAULTS = { sede: '', estado: 'todos', entrega: 'todas' }
const STATUS_OPTIONS = Object.keys(ORDER_STATUS_LABELS) as OnlineOrderStatus[]
const LIMIT_OPTIONS = [20, 50, 100]

export function OnlineOrdersPage() {
  const { user } = useAuth()
  const isSuperadmin = user?.role.name === 'SUPERADMIN'
  const branchOptions = useInventoryBranches()
  const [, setSearchParams] = useSearchParams()
  const { search, filters, params, limitOptions, setPage, setLimit, applySearch, setFilter } =
    usePagination({ filters: FILTER_DEFAULTS, defaultLimit: 20, limitOptions: LIMIT_OPTIONS })

  const requested = branchOptions.branches.find((option) => option.id === filters.sede)
  const branch = requested ?? (isSuperadmin ? null : (branchOptions.branches[0] ?? null))
  const hasListFilters = search !== '' || filters.estado !== 'todos' || filters.entrega !== 'todas'

  const { status, orders, meta, error, refetch } = useOnlineOrders(
    {
      ...params,
      branchId: branch?.id,
      status: filters.estado === 'todos' ? undefined : (filters.estado as OnlineOrderStatus),
      fulfillment:
        filters.entrega === 'todas' ? undefined : (filters.entrega as OnlineOrderFulfillment),
    },
    branchOptions.status === 'success' && (isSuperadmin || branch !== null),
  )
  const [viewing, setViewing] = useState<OnlineOrder | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const updateFilters = (changes: Record<string, string | null>) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key)
          else next.set(key, value)
        }
        next.delete('pagina')
        return next
      },
      { replace: true },
    )

  const handleChanged = (_order: OnlineOrder, message: string) => {
    setViewing(null)
    setFeedback(message)
    refetch()
  }

  const renderList = () => {
    if (branchOptions.status === 'error') {
      return (
        <div className="inventory-page__feedback inventory-page__feedback--inset">
          <Alert tone="error">No fue posible cargar las sedes. Intenta de nuevo.</Alert>
          <Button variant="outline" onClick={branchOptions.reload}>
            Reintentar
          </Button>
        </div>
      )
    }
    if (status === 'loading' || status === 'idle') {
      return <TableSkeleton label="Cargando pedidos..." rows={8} columns={6} />
    }
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
    if (orders.length === 0) {
      return hasListFilters ? (
        <EmptyState
          variant="sin-resultados"
          title="Ningún pedido coincide con los filtros"
          description="Revisa el código, el nombre, el estado o el tipo de entrega."
          onClearFilters={() => updateFilters({ q: null, estado: null, entrega: null })}
        />
      ) : (
        <EmptyState
          variant="sin-registros"
          title="Todavía no hay pedidos web"
          description="Los pedidos que los clientes hacen desde la tienda en línea aparecen aquí para confirmarlos y registrar la compra."
        />
      )
    }
    return <OnlineOrdersTable orders={orders} showBranch={!branch} onView={setViewing} />
  }

  if (branchOptions.status === 'success' && branchOptions.branches.length === 0) {
    return (
      <AppLayout title="Pedidos web">
        <div className="inventory-page__card">
          <EmptyState
            title="No tienes sedes asignadas"
            description="Pide al superadmin que te asigne a una sede para atender sus pedidos."
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title="Pedidos web"
      subtitle={
        meta
          ? meta.openOrders === 1
            ? '1 pedido en curso'
            : `${meta.openOrders} pedidos en curso`
          : undefined
      }
    >
      <div className="inventory-page__toolbar">
        <div className="inventory-page__branch">
          <label className="inventory-page__branch-label" htmlFor="orders-branch">
            Sede
          </label>
          <select
            id="orders-branch"
            className="inventory-page__filter inventory-page__filter--branch"
            value={branch?.id ?? ALL_BRANCHES}
            disabled={branchOptions.status !== 'success'}
            onChange={(event) =>
              updateFilters({
                sede: event.target.value === ALL_BRANCHES ? null : event.target.value,
              })
            }
          >
            {branchOptions.status === 'loading' && <option value="">Cargando sedes...</option>}
            {isSuperadmin && <option value={ALL_BRANCHES}>Todas las sedes</option>}
            {branchOptions.branches.map((option) => (
              <option key={option.id} value={option.id}>
                {option.active ? option.name : `${option.name} (inactiva)`}
              </option>
            ))}
          </select>
        </div>
        <SearchBar
          id="orders-search"
          label="Buscar por código, nombre o celular"
          placeholder="Código, nombre o celular"
          value={search}
          onSearch={(term) => (term === search ? refetch() : applySearch(term))}
        />
      </div>
      <div className="inventory-page__toolbar movements-page__filters">
        <label className="sr-only" htmlFor="orders-status-filter">
          Filtrar por estado
        </label>
        <select
          id="orders-status-filter"
          className="inventory-page__filter"
          value={filters.estado}
          onChange={(event) => setFilter('estado', event.target.value)}
        >
          <option value="todos">Todos los estados</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {ORDER_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="orders-fulfillment-filter">
          Filtrar por tipo de entrega
        </label>
        <select
          id="orders-fulfillment-filter"
          className="inventory-page__filter"
          value={filters.entrega}
          onChange={(event) => setFilter('entrega', event.target.value)}
        >
          <option value="todas">Recoger y domicilio</option>
          <option value="PICKUP">{FULFILLMENT_LABELS.PICKUP}</option>
          <option value="DELIVERY">{FULFILLMENT_LABELS.DELIVERY}</option>
        </select>
        <ReloadButton onReload={refetch} loading={status === 'loading'} />
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
            label="Paginación de pedidos"
            onChange={setPage}
            onLimitChange={setLimit}
          />
        )}
      </div>

      <Modal
        open={viewing !== null}
        title={viewing ? `Pedido ${viewing.code}` : 'Pedido'}
        size="wide"
        onClose={() => setViewing(null)}
      >
        {viewing && (
          <OnlineOrderDetail
            key={viewing.id}
            order={viewing}
            onChanged={handleChanged}
            onCompleted={() => {
              setFeedback(null)
              refetch()
            }}
            onClose={() => setViewing(null)}
          />
        )}
      </Modal>
    </AppLayout>
  )
}

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { SupplyForm } from '../../components/supplies/SupplyForm'
import { SupplyMinimumForm } from '../../components/supplies/SupplyMinimumForm'
import { SupplyMovementForm } from '../../components/supplies/SupplyMovementForm'
import { SupplyStockTable } from '../../components/supplies/SupplyStockTable'
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
import { usePagination } from '../../hooks/usePagination'
import { useSupplyStock } from '../../hooks/useSupplyStock'
import { AppLayout } from '../../layouts/AppLayout'
import type { Supply, SupplyMovement, SupplyStockRow } from '../../types/supply'
import { hasRole } from '../../utils/categories'
import {
  SUPPLY_MANAGE_ROLES,
  SUPPLY_MINIMUM_ROLES,
  SUPPLY_MOVEMENT_ROLES,
  formatSupplyQuantity,
} from '../../utils/supplies'

import './InventoryPage.css'

const ALL_BRANCHES = 'todas'
const FILTER_DEFAULTS = { sede: '', stock: 'todos' }
const LIMIT_OPTIONS = [20, 50, 100]

export function SuppliesPage() {
  const { user } = useAuth()
  const roleName = user?.role.name
  const isSuperadmin = roleName === 'SUPERADMIN'
  const canCreate = hasRole(SUPPLY_MANAGE_ROLES, roleName)
  const canMove = hasRole(SUPPLY_MOVEMENT_ROLES, roleName)
  const canEditMinimum = hasRole(SUPPLY_MINIMUM_ROLES, roleName)
  const branchOptions = useInventoryBranches()
  const [, setSearchParams] = useSearchParams()
  const {
    page,
    search,
    filters,
    hasFilters,
    params,
    limitOptions,
    setPage,
    setLimit,
    applySearch,
    setFilter,
    clearFilters,
  } = usePagination({ filters: FILTER_DEFAULTS, defaultLimit: 20, limitOptions: LIMIT_OPTIONS })
  const requested = branchOptions.branches.find((option) => option.id === filters.sede)
  const branch = requested ?? (isSuperadmin ? null : (branchOptions.branches[0] ?? null))
  const lowStockOnly = filters.stock === 'bajo'

  const { status, rows, meta, error, refetch } = useSupplyStock(
    { ...params, branchId: branch?.id, lowStock: lowStockOnly },
    branchOptions.status === 'success' && (isSuperadmin || branch !== null),
  )

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [moving, setMoving] = useState<SupplyStockRow | null>(null)
  const [editingMinimum, setEditingMinimum] = useState<SupplyStockRow | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const changeBranch = (value: string) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value === ALL_BRANCHES) next.delete('sede')
        else next.set('sede', value)
        next.delete('pagina')
        return next
      },
      { replace: true },
    )

  const handleSearch = (term: string) => {
    if (term === search) refetch()
    else applySearch(term)
  }

  const handleCreated = (supply: Supply) => {
    setIsCreateOpen(false)
    setFeedback(
      `${supply.name} quedó registrado en todas las sedes con stock 0 ${supply.unitOfMeasure.abbreviation}.`,
    )
    if (page === 1) refetch()
    else setPage(1)
  }

  const handleMoved = (movement: SupplyMovement) => {
    const unit = moving?.supply.unitOfMeasure.abbreviation
    setMoving(null)
    setFeedback(
      `${movement.movementType === 'ENTRY' ? 'Entrada' : 'Salida'} de ${formatSupplyQuantity(movement.quantity, unit)} de ${movement.supply.name} registrada. Quedan ${formatSupplyQuantity(movement.resultingQuantity, unit)}.`,
    )
    refetch()
  }

  const handleMinimumSaved = (row: SupplyStockRow) => {
    setEditingMinimum(null)
    setFeedback(
      `El stock mínimo de ${row.supply.name}${row.branchName ? ` en ${row.branchName}` : ''} quedó en ${formatSupplyQuantity(row.minimumQuantity, row.supply.unitOfMeasure.abbreviation)}.`,
    )
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
      return <TableSkeleton label="Cargando insumos..." rows={6} columns={4} />
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
    if (rows.length === 0) {
      if (lowStockOnly && search === '') {
        return (
          <EmptyState
            variant="sin-resultados"
            title="Ningún insumo tiene stock bajo"
            description={`${branch ? `En ${branch.name}` : 'En todas las sedes'} los insumos están en su nivel o por encima del mínimo.`}
            onClearFilters={clearFilters}
          />
        )
      }
      return hasFilters ? (
        <EmptyState
          variant="sin-resultados"
          title="Ningún insumo coincide con los filtros"
          description="Revisa el nombre o quita el filtro de stock bajo."
          onClearFilters={clearFilters}
        />
      ) : (
        <EmptyState
          variant="sin-registros"
          title="Todavía no hay insumos"
          description="Los insumos son las materias primas de las recetas, como la leche o la avena. Cada sede lleva su propio stock."
        >
          {canCreate && <Button onClick={() => setIsCreateOpen(true)}>Registrar insumo</Button>}
        </EmptyState>
      )
    }
    return (
      <SupplyStockTable
        rows={rows}
        showBranch={!branch}
        onMove={
          canMove
            ? (row) => {
                setFeedback(null)
                setMoving(row)
              }
            : undefined
        }
        onEditMinimum={
          canEditMinimum
            ? (row) => {
                setFeedback(null)
                setEditingMinimum(row)
              }
            : undefined
        }
      />
    )
  }

  if (branchOptions.status === 'success' && branchOptions.branches.length === 0) {
    return (
      <AppLayout title="Insumos">
        <div className="inventory-page__card">
          <EmptyState
            title="No tienes sedes asignadas"
            description="Pide al superadmin que te asigne a una sede para consultar sus insumos."
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Insumos">
      <div className="inventory-page__toolbar">
        <div className="inventory-page__branch">
          <label className="inventory-page__branch-label" htmlFor="supplies-branch">
            Sede
          </label>
          <select
            id="supplies-branch"
            className="inventory-page__filter inventory-page__filter--branch"
            value={branch?.id ?? ALL_BRANCHES}
            disabled={branchOptions.status !== 'success'}
            onChange={(event) => changeBranch(event.target.value)}
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
          id="supplies-search"
          label="Buscar insumo por nombre"
          placeholder="Buscar insumo"
          value={search}
          onSearch={handleSearch}
        />
        <label className="sr-only" htmlFor="supplies-stock-filter">
          Filtrar por stock
        </label>
        <select
          id="supplies-stock-filter"
          className="inventory-page__filter"
          value={filters.stock}
          onChange={(event) => setFilter('stock', event.target.value)}
        >
          <option value="todos">Todo el stock</option>
          <option value="bajo">Solo stock bajo</option>
        </select>
        <ReloadButton onReload={refetch} loading={status === 'loading'} />
        {canCreate && (
          <Button
            className="inventory-page__primary"
            onClick={() => {
              setFeedback(null)
              setIsCreateOpen(true)
            }}
          >
            Registrar insumo
          </Button>
        )}
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
            label="Paginación de insumos"
            onChange={setPage}
            onLimitChange={setLimit}
          />
        )}
      </div>

      <Modal
        open={isCreateOpen}
        title="Registrar insumo"
        description="El nombre no puede repetirse."
        onClose={() => setIsCreateOpen(false)}
      >
        {isCreateOpen && (
          <SupplyForm onSaved={handleCreated} onCancel={() => setIsCreateOpen(false)} />
        )}
      </Modal>

      <Modal
        open={moving !== null}
        title={moving ? `Entrada o salida de ${moving.supply.name}` : 'Movimiento de insumo'}
        onClose={() => setMoving(null)}
      >
        {moving && (
          <SupplyMovementForm row={moving} onSaved={handleMoved} onCancel={() => setMoving(null)} />
        )}
      </Modal>

      <Modal
        open={editingMinimum !== null}
        title={editingMinimum ? `Stock mínimo de ${editingMinimum.supply.name}` : 'Stock mínimo'}
        description="Cuando el stock baja de este valor, el insumo se marca con stock bajo."
        onClose={() => setEditingMinimum(null)}
      >
        {editingMinimum && (
          <SupplyMinimumForm
            row={editingMinimum}
            onSaved={handleMinimumSaved}
            onCancel={() => setEditingMinimum(null)}
          />
        )}
      </Modal>
    </AppLayout>
  )
}

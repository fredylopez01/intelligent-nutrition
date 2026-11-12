import { useState } from 'react'

import { PromotionForm } from '../../components/promotions/PromotionForm'
import { PromotionsTable } from '../../components/promotions/PromotionsTable'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { ReloadButton } from '../../components/ui/ReloadButton'
import { SearchBar } from '../../components/ui/SearchBar'
import { StatusConfirmation } from '../../components/ui/StatusConfirmation'
import { TableSkeleton } from '../../components/ui/TableSkeleton'
import { useAuth } from '../../hooks/useAuth'
import { usePagination } from '../../hooks/usePagination'
import { usePromotions } from '../../hooks/usePromotions'
import { AppLayout } from '../../layouts/AppLayout'
import { promotionsService } from '../../services/promotions.service'
import type { Promotion } from '../../types/promotion'
import { formatPercentage, resolvePromotionError } from '../../utils/promotions'

import '../catalog/CatalogPage.css'

const SKELETON_ROWS = 5

const ACTIVE_FILTER_VALUES: Record<string, boolean | undefined> = {
  activas: true,
  inactivas: false,
}

const FILTER_DEFAULTS = { estado: 'todos' }

export function PromotionsPage() {
  const { token } = useAuth()
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
  } = usePagination({ filters: FILTER_DEFAULTS })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [statusTarget, setStatusTarget] = useState<Promotion | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const { status, promotions, meta, error, refetch } = usePromotions({
    ...params,
    active: ACTIVE_FILTER_VALUES[filters.estado],
  })

  const handleSearch = (term: string) => {
    if (term === search) refetch()
    else applySearch(term)
  }

  const openCreate = () => {
    setFeedback(null)
    setIsCreateOpen(true)
  }

  const handleCreated = (promotion: Promotion) => {
    setIsCreateOpen(false)
    setFeedback(
      `La promoción ${promotion.name} (${formatPercentage(promotion.discountPercentage)}) quedó registrada e inactiva. Actívala cuando quieras aplicarla en las ventas.`,
    )
    if (page === 1) refetch()
    else setPage(1)
  }

  const handleUpdated = (promotion: Promotion) => {
    setEditing(null)
    setFeedback(`Se guardaron los cambios de ${promotion.name}.`)
    refetch()
  }

  const handleChangeStatus = async (promotion: Promotion) => {
    await promotionsService.updateStatus(promotion.id, !promotion.active, token)
    setStatusTarget(null)
    setFeedback(
      promotion.active
        ? `${promotion.name} quedó inactiva: las ventas nuevas ya no tienen este descuento.`
        : `${promotion.name} quedó activa: las ventas nuevas tienen ${formatPercentage(promotion.discountPercentage)} de descuento.`,
    )
    refetch()
  }

  const renderList = () => {
    if (status === 'loading') {
      return <TableSkeleton label="Cargando promociones..." rows={SKELETON_ROWS} />
    }

    if (status === 'error') {
      return (
        <div className="catalog-page__feedback catalog-page__feedback--inset">
          <Alert tone="error">{error}</Alert>
          <Button variant="outline" onClick={refetch}>
            Reintentar
          </Button>
        </div>
      )
    }

    if (promotions.length === 0) {
      return hasFilters ? (
        <EmptyState
          variant="sin-resultados"
          title="Ninguna promoción coincide con los filtros"
          description="Revisa el nombre o cambia el filtro de estado."
          onClearFilters={clearFilters}
        />
      ) : (
        <EmptyState
          variant="sin-registros"
          title="Todavía no hay promociones"
          description="Una promoción activa descuenta un porcentaje del total de cada venta en todas las sedes."
        >
          <Button onClick={openCreate}>Registrar promoción</Button>
        </EmptyState>
      )
    }

    return (
      <PromotionsTable
        promotions={promotions}
        onEdit={(promotion) => {
          setFeedback(null)
          setEditing(promotion)
        }}
        onToggleStatus={(promotion) => {
          setFeedback(null)
          setStatusTarget(promotion)
        }}
      />
    )
  }

  return (
    <AppLayout title="Promociones">
      <div className="catalog-page__toolbar">
        <SearchBar
          id="promotions-search"
          label="Buscar promoción por nombre"
          placeholder="Buscar por nombre"
          value={search}
          onSearch={handleSearch}
        />
        <label className="sr-only" htmlFor="promotions-status-filter">
          Filtrar por estado
        </label>
        <select
          id="promotions-status-filter"
          className="catalog-page__filter"
          value={filters.estado}
          onChange={(event) => setFilter('estado', event.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="activas">Activas</option>
          <option value="inactivas">Inactivas</option>
        </select>
        <ReloadButton onReload={refetch} loading={status === 'loading'} />
        <Button className="catalog-page__primary" onClick={openCreate}>
          Registrar promoción
        </Button>
      </div>

      {feedback && (
        <div className="catalog-page__feedback">
          <Alert tone="success">{feedback}</Alert>
        </div>
      )}

      <div className="catalog-page__card">{renderList()}</div>

      <div className="catalog-page__footer">
        {status === 'success' && meta && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={params.limit}
            limitOptions={limitOptions}
            label="Paginación de promociones"
            onChange={setPage}
            onLimitChange={setLimit}
          />
        )}
      </div>

      <Modal
        open={isCreateOpen}
        title="Registrar promoción"
        description="El nombre no puede repetirse y las fechas no pueden cruzarse con las de otra promoción."
        onClose={() => setIsCreateOpen(false)}
      >
        {isCreateOpen && (
          <PromotionForm onSaved={handleCreated} onCancel={() => setIsCreateOpen(false)} />
        )}
      </Modal>

      <Modal open={editing !== null} title="Editar promoción" onClose={() => setEditing(null)}>
        {editing && (
          <PromotionForm
            promotion={editing}
            onSaved={handleUpdated}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal
        open={statusTarget !== null}
        title={statusTarget?.active ? '¿Desactivar esta promoción?' : '¿Activar esta promoción?'}
        description={
          statusTarget?.active
            ? `Las ventas nuevas dejan de tener el ${formatPercentage(statusTarget.discountPercentage)} de descuento. Las ventas ya registradas lo conservan.`
            : `Las ventas nuevas de todas las sedes tendrán ${statusTarget ? formatPercentage(statusTarget.discountPercentage) : ''} de descuento. Si hay otra promoción activa, se desactiva automáticamente.`
        }
        onClose={() => setStatusTarget(null)}
      >
        {statusTarget && (
          <StatusConfirmation
            active={statusTarget.active}
            onConfirm={() => handleChangeStatus(statusTarget)}
            onCancel={() => setStatusTarget(null)}
            resolveError={(err) =>
              resolvePromotionError(
                err,
                'No fue posible cambiar el estado de la promoción. Intenta de nuevo.',
              )
            }
          />
        )}
      </Modal>
    </AppLayout>
  )
}

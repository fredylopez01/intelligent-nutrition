import { useEffect, useState } from 'react'

import { RecipeDetail } from '../../components/recipes/RecipeDetail'
import { RecipeForm } from '../../components/recipes/RecipeForm'
import { RecipesTable } from '../../components/recipes/RecipesTable'
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
import { useRecipes } from '../../hooks/useRecipes'
import { AppLayout } from '../../layouts/AppLayout'
import { recipesService } from '../../services/recipes.service'
import type { Recipe, RecipeSummary } from '../../types/recipe'
import { hasRole } from '../../utils/categories'
import { RECIPE_MANAGE_ROLES, RECIPE_STATUS_ROLES, resolveRecipeError } from '../../utils/recipes'

import './CatalogPage.css'
import '../../components/recipes/Recipes.css'

const SKELETON_ROWS = 5

const ACTIVE_FILTER_VALUES: Record<string, boolean | undefined> = {
  activas: true,
  inactivas: false,
}

const FILTER_DEFAULTS = { estado: 'todos' }

type DetailMode = 'view' | 'edit'

interface DetailTarget {
  summary: RecipeSummary
  mode: DetailMode
}

interface LoadedRecipe {
  id: string
  recipe: Recipe | null
  error: string | null
}

export function RecipesPage() {
  const { user, token } = useAuth()
  const canEdit = hasRole(RECIPE_MANAGE_ROLES, user?.role.name)
  const canChangeStatus = hasRole(RECIPE_STATUS_ROLES, user?.role.name)
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
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const [loaded, setLoaded] = useState<LoadedRecipe | null>(null)
  const [statusTarget, setStatusTarget] = useState<RecipeSummary | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const { status, recipes, meta, error, refetch } = useRecipes({
    ...params,
    active: ACTIVE_FILTER_VALUES[filters.estado],
  })

  const detailId = detail?.summary.id ?? null
  useEffect(() => {
    if (!detailId) return
    let cancelled = false
    recipesService
      .get(detailId, token)
      .then((recipe) => {
        if (!cancelled) setLoaded({ id: detailId, recipe, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoaded({
          id: detailId,
          recipe: null,
          error: resolveRecipeError(err, 'No fue posible cargar la receta. Intenta de nuevo.'),
        })
      })
    return () => {
      cancelled = true
    }
  }, [detailId, token])
  const current = loaded?.id === detailId ? loaded : null

  const handleSearch = (term: string) => {
    if (term === search) refetch()
    else applySearch(term)
  }

  const openCreate = () => {
    setFeedback(null)
    setIsCreateOpen(true)
  }

  const openDetail = (summary: RecipeSummary, mode: DetailMode) => {
    setFeedback(null)
    setLoaded(null)
    setDetail({ summary, mode })
  }

  const closeDetail = () => {
    setDetail(null)
    setLoaded(null)
  }

  const handleCreated = (recipe: Recipe) => {
    setIsCreateOpen(false)
    setFeedback(
      `La receta ${recipe.name} quedó registrada con ${recipe.ingredients.length} ingredientes.`,
    )
    if (page === 1) refetch()
    else setPage(1)
  }

  const handleUpdated = (recipe: Recipe) => {
    closeDetail()
    setFeedback(`Se guardaron los cambios de ${recipe.name}.`)
    refetch()
  }

  const handleChangeStatus = async (recipe: RecipeSummary) => {
    await recipesService.updateStatus(recipe.id, !recipe.active, token)
    setStatusTarget(null)
    setFeedback(
      recipe.active
        ? `${recipe.name} quedó inactiva: ya no se puede usar en las ventas.`
        : `${recipe.name} quedó activa.`,
    )
    refetch()
  }

  const renderList = () => {
    if (status === 'loading') {
      return <TableSkeleton label="Cargando recetas..." rows={SKELETON_ROWS} />
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
    if (recipes.length === 0) {
      return hasFilters ? (
        <EmptyState
          variant="sin-resultados"
          title="Ninguna receta coincide con los filtros"
          description="Revisa el nombre o cambia el filtro de estado."
          onClearFilters={clearFilters}
        />
      ) : (
        <EmptyState
          variant="sin-registros"
          title="Todavía no hay recetas"
          description="Una receta lista los insumos que se gastan al preparar un producto, como un batido."
        >
          {canEdit && <Button onClick={openCreate}>Registrar receta</Button>}
        </EmptyState>
      )
    }
    return (
      <RecipesTable
        recipes={recipes}
        canEdit={canEdit}
        canChangeStatus={canChangeStatus}
        onView={(recipe) => openDetail(recipe, 'view')}
        onEdit={(recipe) => openDetail(recipe, 'edit')}
        onToggleStatus={(recipe) => {
          setFeedback(null)
          setStatusTarget(recipe)
        }}
      />
    )
  }

  const renderDetail = () => {
    if (!detail) return null
    if (!current) {
      return (
        <p className="recipe-detail__loading" role="status">
          Cargando la receta...
        </p>
      )
    }
    if (!current.recipe) {
      return (
        <div className="catalog-page__feedback">
          <Alert tone="error">{current.error}</Alert>
          <div>
            <Button variant="outline" onClick={closeDetail}>
              Cerrar
            </Button>
          </div>
        </div>
      )
    }
    if (detail.mode === 'edit') {
      return <RecipeForm recipe={current.recipe} onSaved={handleUpdated} onCancel={closeDetail} />
    }
    return (
      <>
        <RecipeDetail recipe={current.recipe} />
        <div className="recipe-detail__actions">
          <Button variant="outline" onClick={closeDetail}>
            Cerrar
          </Button>
          {canEdit && (
            <Button onClick={() => setDetail({ summary: detail.summary, mode: 'edit' })}>
              Editar receta
            </Button>
          )}
        </div>
      </>
    )
  }

  return (
    <AppLayout title="Recetas">
      <div className="catalog-page__toolbar">
        <SearchBar
          id="recipes-search"
          label="Buscar receta por nombre"
          placeholder="Buscar por nombre"
          value={search}
          onSearch={handleSearch}
        />
        <label className="sr-only" htmlFor="recipes-status-filter">
          Filtrar por estado
        </label>
        <select
          id="recipes-status-filter"
          className="catalog-page__filter"
          value={filters.estado}
          onChange={(event) => setFilter('estado', event.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="activas">Activas</option>
          <option value="inactivas">Inactivas</option>
        </select>
        <ReloadButton onReload={refetch} loading={status === 'loading'} />
        {canEdit && (
          <Button className="catalog-page__primary" onClick={openCreate}>
            Registrar receta
          </Button>
        )}
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
            label="Paginación de recetas"
            onChange={setPage}
            onLimitChange={setLimit}
          />
        )}
      </div>

      <Modal
        open={isCreateOpen}
        title="Registrar receta"
        description="El nombre no puede repetirse y cada insumo solo puede aparecer una vez."
        size="wide"
        onClose={() => setIsCreateOpen(false)}
      >
        {isCreateOpen && (
          <RecipeForm onSaved={handleCreated} onCancel={() => setIsCreateOpen(false)} />
        )}
      </Modal>

      <Modal
        open={detail !== null}
        title={
          detail?.mode === 'edit' ? `Editar ${detail.summary.name}` : (detail?.summary.name ?? '')
        }
        size="wide"
        onClose={closeDetail}
      >
        {renderDetail()}
      </Modal>

      <Modal
        open={statusTarget !== null}
        title={statusTarget?.active ? '¿Desactivar esta receta?' : '¿Activar esta receta?'}
        description={
          statusTarget?.active
            ? 'La receta deja de estar disponible para las ventas. Su historial se conserva.'
            : 'La receta vuelve a estar disponible para las ventas.'
        }
        onClose={() => setStatusTarget(null)}
      >
        {statusTarget && (
          <StatusConfirmation
            active={statusTarget.active}
            onConfirm={() => handleChangeStatus(statusTarget)}
            onCancel={() => setStatusTarget(null)}
            resolveError={(err) =>
              resolveRecipeError(
                err,
                'No fue posible cambiar el estado de la receta. Intenta de nuevo.',
              )
            }
          />
        )}
      </Modal>
    </AppLayout>
  )
}

import { useSearchParams } from 'react-router-dom'

import { RestockTable } from '../../components/reports/RestockTable'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ReloadButton } from '../../components/ui/ReloadButton'
import { TableSkeleton } from '../../components/ui/TableSkeleton'
import { useAuth } from '../../hooks/useAuth'
import { useInventoryBranches } from '../../hooks/useInventoryBranches'
import { useRestockReport } from '../../hooks/useRestockReport'
import { AppLayout } from '../../layouts/AppLayout'

import '../inventory/InventoryPage.css'
import '../../components/reports/Reports.css'

const ALL_BRANCHES = 'todas'

export function RestockPage() {
  const { user } = useAuth()
  const isSuperadmin = user?.role.name === 'SUPERADMIN'
  const branchOptions = useInventoryBranches()
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = branchOptions.branches.find((option) => option.id === searchParams.get('sede'))
  const branch = requested ?? (isSuperadmin ? null : (branchOptions.branches[0] ?? null))

  const { status, rows, error, refetch } = useRestockReport(
    branch?.id,
    branchOptions.status === 'success' && (isSuperadmin || branch !== null),
  )
  const suggestedTotal = rows.reduce((sum, row) => sum + row.suggestedUnits, 0)

  const changeBranch = (value: string) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value === ALL_BRANCHES) next.delete('sede')
        else next.set('sede', value)
        return next
      },
      { replace: true },
    )

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
      return <TableSkeleton label="Calculando la reposición sugerida..." rows={6} columns={4} />
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
      return (
        <EmptyState
          variant="sin-registros"
          title="Ningún producto está por debajo de su stock mínimo"
          description={`${branch ? branch.name : 'Todas las sedes'} tiene${branch ? '' : 'n'} sus productos activos en el mínimo o por encima.`}
        />
      )
    }
    return <RestockTable rows={rows} showBranch={!branch} />
  }

  if (branchOptions.status === 'success' && branchOptions.branches.length === 0) {
    return (
      <AppLayout title="Reposición sugerida">
        <div className="inventory-page__card">
          <EmptyState
            title="No tienes sedes asignadas"
            description="Pide al superadmin que te asigne a una sede para consultar su reposición."
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Reposición sugerida">
      <div className="inventory-page__toolbar">
        <div className="inventory-page__branch">
          <label className="inventory-page__branch-label" htmlFor="restock-branch">
            Sede
          </label>
          <select
            id="restock-branch"
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
        <ReloadButton onReload={refetch} loading={status === 'loading'} />
      </div>

      {status === 'success' && rows.length > 0 && (
        <dl className="reports-summary" aria-label="Resumen de la reposición">
          <div className="reports-summary__item">
            <dt>Productos por reponer</dt>
            <dd>{rows.length}</dd>
          </div>
          <div className="reports-summary__item">
            <dt>Unidades sugeridas</dt>
            <dd>{suggestedTotal} und</dd>
          </div>
          <p className="reports-summary__note">
            La demanda de 7 días se proyecta con el promedio diario de ventas de los últimos 30
            días. Reponer cubre el mayor entre el stock mínimo y esa demanda. Es una sugerencia
            informativa.
          </p>
        </dl>
      )}

      <div className="inventory-page__card">{renderList()}</div>
    </AppLayout>
  )
}

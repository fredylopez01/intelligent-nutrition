import { Link, useSearchParams } from 'react-router-dom'

import {
  AlertsPanel,
  BranchesPanel,
  SalesCard,
  StockCard,
  TopProductsPanel,
} from '../../components/dashboard/DashboardPanels'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useBranchDashboard } from '../../hooks/useBranchDashboard'
import { useInventoryBranches } from '../../hooks/useInventoryBranches'
import { AppLayout } from '../../layouts/AppLayout'
import { canAccess } from '../../routes/access'
import { GLOBAL_SCOPE, greetingName, todayLabel } from '../../utils/dashboard'
import { businessToday } from '../../utils/inventoryClosures'

import '../../components/dashboard/Dashboard.css'

const BRANCH_PARAM = 'sede'

function DashboardSkeleton({ withBranches }: { withBranches: boolean }) {
  return (
    <div className="dashboard" role="status" aria-label="Cargando indicadores...">
      <div className="dashboard__row dashboard__row--cards">
        {[0, 1].map((index) => (
          <div key={index} className="dashboard-panel dashboard-panel--skeleton" aria-hidden="true">
            <span className="dashboard-skeleton dashboard-skeleton--label" />
            <span className="dashboard-skeleton dashboard-skeleton--value" />
            <span className="dashboard-skeleton dashboard-skeleton--line" />
          </div>
        ))}
      </div>
      {withBranches && (
        <div className="dashboard-panel dashboard-panel--skeleton" aria-hidden="true">
          <span className="dashboard-skeleton dashboard-skeleton--label" />
          <span className="dashboard-skeleton dashboard-skeleton--line" />
          <span className="dashboard-skeleton dashboard-skeleton--line" />
        </div>
      )}
      <div className="dashboard__row dashboard__row--lists">
        {[0, 1].map((index) => (
          <div key={index} className="dashboard-panel dashboard-panel--skeleton" aria-hidden="true">
            <span className="dashboard-skeleton dashboard-skeleton--label" />
            <span className="dashboard-skeleton dashboard-skeleton--line" />
            <span className="dashboard-skeleton dashboard-skeleton--line" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const roleName = user?.role.name
  const isSuperadmin = roleName === 'SUPERADMIN'
  const branchOptions = useInventoryBranches()
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get(BRANCH_PARAM)
  const requestedBranch = branchOptions.branches.find((option) => option.id === requested)
  const fallbackBranch =
    branchOptions.branches.find((option) => option.active) ?? branchOptions.branches[0] ?? null
  const scope = isSuperadmin
    ? (requestedBranch?.id ?? GLOBAL_SCOPE)
    : ((requestedBranch ?? fallbackBranch)?.id ?? null)
  const { status, dashboard, error, refetch } = useBranchDashboard(
    branchOptions.status === 'success' ? scope : null,
  )
  const isGlobal = scope === GLOBAL_SCOPE
  const today = dashboard?.date ?? businessToday()
  const canUse = (path: string) => canAccess(path, roleName)
  const branchQuery = scope && scope !== GLOBAL_SCOPE ? `?${BRANCH_PARAM}=${scope}` : ''

  const changeScope = (value: string) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value === GLOBAL_SCOPE) next.delete(BRANCH_PARAM)
        else next.set(BRANCH_PARAM, value)
        return next
      },
      { replace: true },
    )

  const actions = (
    <div className="dashboard__actions">
      <label className="sr-only" htmlFor="dashboard-branch">
        Sede
      </label>
      <select
        id="dashboard-branch"
        className="dashboard__scope"
        value={scope ?? ''}
        disabled={
          branchOptions.status !== 'success' || (!isSuperadmin && branchOptions.branches.length < 2)
        }
        onChange={(event) => changeScope(event.target.value)}
      >
        {branchOptions.status === 'loading' && <option value="">Cargando sedes...</option>}
        {isSuperadmin && <option value={GLOBAL_SCOPE}>Todas las sedes</option>}
        {branchOptions.branches.map((option) => (
          <option key={option.id} value={option.id}>
            {option.active ? option.name : `${option.name} (inactiva)`}
          </option>
        ))}
      </select>
      {canUse('/pos') && (
        <Link className="dashboard__primary" to="/pos">
          Nueva venta
        </Link>
      )}
    </div>
  )

  const renderContent = () => {
    if (branchOptions.status === 'error') {
      return (
        <div className="dashboard__feedback">
          <Alert tone="error">No fue posible cargar las sedes. Intenta de nuevo.</Alert>
          <Button variant="outline" onClick={branchOptions.reload}>
            Reintentar
          </Button>
        </div>
      )
    }
    if (status === 'error') {
      return (
        <div className="dashboard__feedback">
          <Alert tone="error">{error}</Alert>
          <Button variant="outline" onClick={refetch}>
            Reintentar
          </Button>
        </div>
      )
    }
    if (status !== 'success' || !dashboard) return <DashboardSkeleton withBranches={isGlobal} />
    return (
      <div className="dashboard">
        <div className="dashboard__row dashboard__row--cards">
          <SalesCard dashboard={dashboard} />
          <StockCard dashboard={dashboard} />
        </div>
        {isGlobal && <BranchesPanel dashboard={dashboard} canUse={canUse} />}
        <div className="dashboard__row dashboard__row--lists">
          <AlertsPanel
            dashboard={dashboard}
            inventoryLink={canUse('/inventario') ? `/inventario${branchQuery}` : null}
            canUse={canUse}
          />
          <TopProductsPanel dashboard={dashboard} />
        </div>
      </div>
    )
  }

  const name = greetingName(user?.fullName)
  const title = name ? `Hola, ${name}` : 'Dashboard'

  if (!isSuperadmin && branchOptions.status === 'success' && branchOptions.branches.length === 0) {
    return (
      <AppLayout title={title}>
        <div className="dashboard-panel">
          <EmptyState
            title="No tienes sedes asignadas"
            description="Pide al superadmin que te asigne a una sede para ver sus indicadores."
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={title}
      subtitle={`${todayLabel(today)}, cierre parcial del día`}
      actions={actions}
    >
      {renderContent()}
    </AppLayout>
  )
}

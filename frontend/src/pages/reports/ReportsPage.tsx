import { useSearchParams } from 'react-router-dom'

import { SalesReportTable } from '../../components/reports/SalesReportTable'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { DownloadPdfButton } from '../../components/ui/DownloadPdfButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { Pagination } from '../../components/ui/Pagination'
import { ReloadButton } from '../../components/ui/ReloadButton'
import { TableSkeleton } from '../../components/ui/TableSkeleton'
import { useAuth } from '../../hooks/useAuth'
import { useInventoryBranches } from '../../hooks/useInventoryBranches'
import { usePagination } from '../../hooks/usePagination'
import { useSalesReport } from '../../hooks/useSalesReport'
import { AppLayout } from '../../layouts/AppLayout'
import { reportsService } from '../../services/reports.service'
import type { SalesReportRow } from '../../types/report'
import { downloadSalesReport } from '../../utils/pdf/reportsPdf'
import { formatPrice } from '../../utils/products'
import { defaultReportRange, summarizeSalesReport } from '../../utils/reports'

import '../inventory/InventoryPage.css'
import '../inventory/MovementsPage.css'
import '../../components/reports/Reports.css'

const ALL_BRANCHES = 'todas'
const FILTER_DEFAULTS = { sede: '', desde: '', hasta: '' }
const LIMIT_OPTIONS = [20, 50, 100]
const EXPORT_PAGE_SIZE = 100

export function ReportsPage() {
  const { user, token } = useAuth()
  const isSuperadmin = user?.role.name === 'SUPERADMIN'
  const branchOptions = useInventoryBranches()
  const [, setSearchParams] = useSearchParams()
  const { filters, params, limitOptions, setPage, setLimit, setFilter } = usePagination({
    filters: FILTER_DEFAULTS,
    defaultLimit: 20,
    limitOptions: LIMIT_OPTIONS,
  })
  const defaults = defaultReportRange()
  const from = filters.desde || defaults.from
  const to = filters.hasta || defaults.to
  const invalidRange = from > to

  const requested = branchOptions.branches.find((option) => option.id === filters.sede)
  const branch = requested ?? (isSuperadmin ? null : (branchOptions.branches[0] ?? null))

  const { status, rows, meta, error, refetch } = useSalesReport(
    { ...params, branchId: branch?.id, from, to },
    branchOptions.status === 'success' && (isSuperadmin || branch !== null) && !invalidRange,
  )
  const summary = summarizeSalesReport(rows)
  const partial = meta !== null && meta.totalPages > 1

  const downloadPdf = async () => {
    const allRows: SalesReportRow[] = []
    for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
      const response = await reportsService.sales(
        { page, limit: EXPORT_PAGE_SIZE, branchId: branch?.id, from, to },
        token,
      )
      allRows.push(...response.data)
      totalPages = response.meta.totalPages
    }
    await downloadSalesReport({ rows: allRows, branch, from, to })
  }

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
    if (invalidRange) {
      return (
        <div className="inventory-page__feedback inventory-page__feedback--inset">
          <Alert tone="info">La fecha inicial debe ser anterior o igual a la fecha final.</Alert>
        </div>
      )
    }
    if (status === 'loading' || status === 'idle') {
      return <TableSkeleton label="Cargando el reporte de ventas..." rows={8} columns={4} />
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
          variant="sin-resultados"
          title="No hay ventas en este período"
          description={`${branch ? `${branch.name} no tiene` : 'Ninguna sede tiene'} ventas completadas entre las fechas elegidas. Prueba con otro rango.`}
        />
      )
    }
    return <SalesReportTable rows={rows} showBranch={!branch} />
  }

  if (branchOptions.status === 'success' && branchOptions.branches.length === 0) {
    return (
      <AppLayout title="Reportes">
        <div className="inventory-page__card">
          <EmptyState
            title="No tienes sedes asignadas"
            description="Pide al superadmin que te asigne a una sede para consultar sus reportes."
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Reportes">
      <div className="inventory-page__toolbar">
        <div className="inventory-page__branch">
          <label className="inventory-page__branch-label" htmlFor="reports-branch">
            Sede
          </label>
          <select
            id="reports-branch"
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
        <div className="movements-page__dates">
          <label className="movements-page__date">
            <span>Desde</span>
            <input
              type="date"
              className="inventory-page__filter"
              value={from}
              max={to}
              onChange={(event) => setFilter('desde', event.target.value)}
            />
          </label>
          <label className="movements-page__date">
            <span>Hasta</span>
            <input
              type="date"
              className="inventory-page__filter"
              value={to}
              onChange={(event) => setFilter('hasta', event.target.value)}
            />
          </label>
        </div>
        <ReloadButton onReload={refetch} loading={status === 'loading'} />
        <DownloadPdfButton
          label="Descargar PDF"
          onDownload={downloadPdf}
          disabled={status !== 'success' || rows.length === 0}
        />
      </div>

      {status === 'success' && rows.length > 0 && (
        <dl className="reports-summary" aria-label="Resumen del período">
          <div className="reports-summary__item">
            <dt>Total vendido</dt>
            <dd>{formatPrice(summary.totalCents / 100)}</dd>
          </div>
          <div className="reports-summary__item">
            <dt>Ventas</dt>
            <dd>{summary.salesCount}</dd>
          </div>
          <div className="reports-summary__item">
            <dt>Ticket promedio</dt>
            <dd>{formatPrice(summary.averageCents / 100)}</dd>
          </div>
          {partial && (
            <p className="reports-summary__note">
              El resumen suma los días de esta página. Muestra más filas por página para ver todo el
              período.
            </p>
          )}
        </dl>
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
            label="Paginación del reporte de ventas"
            onChange={setPage}
            onLimitChange={setLimit}
          />
        )}
      </div>
    </AppLayout>
  )
}

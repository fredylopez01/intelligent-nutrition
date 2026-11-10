import { type FormEvent, useEffect, useRef, useState } from 'react'

import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Pagination } from '../../components/ui/Pagination'
import { ReloadButton } from '../../components/ui/ReloadButton'
import { TableSkeleton } from '../../components/ui/TableSkeleton'
import { TextAreaField } from '../../components/ui/TextAreaField'
import { TextField } from '../../components/ui/TextField'
import { useAuth } from '../../hooks/useAuth'
import { usePagination } from '../../hooks/usePagination'
import { AppLayout } from '../../layouts/AppLayout'
import { ApiError } from '../../services/http'
import { cashShiftsService } from '../../services/cashShifts.service'
import type { CashShift, CashShiftSummary, CashShiftsListParams } from '../../types/cashShift'

import '../inventory/InventoryPage.css'
import '../inventory/ClosurePage.css'
import './CashShiftPage.css'

const AMOUNT_PATTERN = /^\d+\.\d{2}$/
const OBSERVATION_MAX = 300
const HISTORY_FILTER_DEFAULTS = { estado: 'todos', desde: '', hasta: '' }

function formatCOP(value: string | null): string {
  if (!value) return '—'
  const number = parseFloat(value)
  if (Number.isNaN(number)) return value
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number)
}

function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(isoString))
}

function resolveCashShiftError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case 'SHIFT_ALREADY_OPEN':
      return 'Ya tienes un turno de caja abierto. Recarga la página para verlo.'
    case 'SHIFT_ALREADY_CLOSED':
      return 'Este turno ya está cerrado.'
    case 'SHIFT_OWNER_REQUIRED':
      return 'Solo quien abrió el turno puede cerrarlo.'
    case 'BRANCH_SCOPE_VIOLATION':
      return 'No tienes acceso a esta sede.'
  }
  if (error.status === 403) return 'No tienes permiso para realizar esta acción.'
  if (error.status === 404) return 'El turno ya no existe. Recarga la página.'
  if (error.status === 400) return 'Revisa los datos ingresados e intenta de nuevo.'
  return fallback
}

function computeDifference(openingAmount: string, closingAmount: string): number | null {
  const opening = parseFloat(openingAmount)
  const closing = parseFloat(closingAmount)
  if (Number.isNaN(opening) || Number.isNaN(closing)) return null
  return closing - opening
}

export function CashShiftPage() {
  const { user, token } = useAuth()
  const roleName = user?.role.name
  const isBranchRole = roleName === 'BRANCH_LEADER' || roleName === 'BRANCH_ASSISTANT'
  const userBranches = user?.branches ?? []
  const defaultBranchId = userBranches.length === 1 ? userBranches[0].id : ''

  const [openShift, setOpenShift] = useState<CashShift | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [openBranchId, setOpenBranchId] = useState(defaultBranchId)
  const [openingAmount, setOpeningAmount] = useState('')
  const [openObservation, setOpenObservation] = useState('')
  const [openAmountError, setOpenAmountError] = useState('')
  const [openBranchError, setOpenBranchError] = useState('')
  const [submittingOpen, setSubmittingOpen] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  const [closingAmount, setClosingAmount] = useState('')
  const [closeObservation, setCloseObservation] = useState('')
  const [closingAmountError, setClosingAmountError] = useState('')
  const [submittingClose, setSubmittingClose] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  const { filters, params, limitOptions, setPage, setLimit, setFilter } = usePagination({
    filters: HISTORY_FILTER_DEFAULTS,
  })
  const [historyShifts, setHistoryShifts] = useState<CashShiftSummary[]>([])
  const [historyMeta, setHistoryMeta] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null)
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [historyError, setHistoryError] = useState<string | null>(null)
  const historyAbort = useRef<AbortController | null>(null)

  const loadOpenShift = () => {
    setLoadError(null)
    setOpenShift(undefined)

    const listParams: CashShiftsListParams = { status: 'OPEN', userId: user?.id }
    if (roleName === 'BRANCH_LEADER') {
      const branchId = userBranches[0]?.id
      if (!branchId) {
        setOpenShift(null)
        return
      }
      listParams.branchId = branchId
    }

    cashShiftsService
      .list(listParams, token)
      .then((response) => {
        const summary = response.data[0] ?? null
        if (!summary) {
          setOpenShift(null)
          return
        }
        return cashShiftsService.findOne(summary.id, token).then((full) => setOpenShift(full))
      })
      .catch((error: unknown) => {
        setLoadError(
          resolveCashShiftError(error, 'No fue posible verificar si tienes un turno abierto.'),
        )
        setOpenShift(null)
      })
  }

  useEffect(() => {
    loadOpenShift()
  }, [user?.id])

  const loadHistory = () => {
    historyAbort.current?.abort()
    const controller = new AbortController()
    historyAbort.current = controller

    setHistoryStatus('loading')
    setHistoryError(null)

    const listParams: CashShiftsListParams = {
      page: params.page,
      limit: params.limit,
      status: filters.estado !== 'todos' ? (filters.estado as 'OPEN' | 'CLOSED') : undefined,
      from: filters.desde || undefined,
      to: filters.hasta || undefined,
    }
    if (roleName === 'BRANCH_LEADER') {
      listParams.branchId = userBranches[0]?.id
    }

    cashShiftsService
      .list(listParams, token)
      .then((response) => {
        if (controller.signal.aborted) return
        setHistoryShifts(response.data)
        setHistoryMeta(response.meta)
        setHistoryStatus('idle')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setHistoryError(
          resolveCashShiftError(error, 'No fue posible cargar el historial de turnos.'),
        )
        setHistoryStatus('error')
      })
  }

  useEffect(() => {
    if (openShift === undefined) return
    loadHistory()
    return () => historyAbort.current?.abort()
  }, [openShift, params.page, params.limit, filters.estado, filters.desde, filters.hasta])

  const handleOpenShift = async (event: FormEvent) => {
    event.preventDefault()
    let valid = true

    if (!openBranchId) {
      setOpenBranchError('Elige una sede para abrir el turno.')
      valid = false
    } else {
      setOpenBranchError('')
    }

    if (!AMOUNT_PATTERN.test(openingAmount)) {
      setOpenAmountError('Escribe el monto con dos decimales, por ejemplo 50000.00')
      valid = false
    } else {
      setOpenAmountError('')
    }

    if (!valid) return

    setSubmittingOpen(true)
    setOpenError(null)

    try {
      const shift = await cashShiftsService.open(
        {
          branchId: openBranchId,
          openingAmount,
          observation: openObservation.trim() || undefined,
        },
        token,
      )
      setOpenShift(shift)
      setOpeningAmount('')
      setOpenObservation('')
      loadHistory()
    } catch (error: unknown) {
      setOpenError(resolveCashShiftError(error, 'No fue posible abrir el turno. Intenta de nuevo.'))
    } finally {
      setSubmittingOpen(false)
    }
  }

  const handleCloseShift = async (event: FormEvent) => {
    event.preventDefault()
    if (!openShift) return

    if (!AMOUNT_PATTERN.test(closingAmount)) {
      setClosingAmountError('Escribe el monto con dos decimales, por ejemplo 380000.00')
      return
    }
    setClosingAmountError('')

    setSubmittingClose(true)
    setCloseError(null)

    try {
      await cashShiftsService.close(
        openShift.id,
        {
          closingAmount,
          observation: closeObservation.trim() || undefined,
        },
        token,
      )
      setOpenShift(null)
      setClosingAmount('')
      setCloseObservation('')
      loadHistory()
    } catch (error: unknown) {
      setCloseError(
        resolveCashShiftError(error, 'No fue posible cerrar el turno. Intenta de nuevo.'),
      )
    } finally {
      setSubmittingClose(false)
    }
  }

  const difference =
    openShift && AMOUNT_PATTERN.test(closingAmount)
      ? computeDifference(openShift.openingAmount, closingAmount)
      : null

  const renderCurrentShift = () => {
    if (!isBranchRole) return null

    if (openShift === undefined) {
      return (
        <p className="cash-shift-page__loading" role="status">
          Verificando turno activo...
        </p>
      )
    }

    if (loadError) {
      return (
        <div className="cash-shift-page__card">
          <Alert tone="error">{loadError}</Alert>
          <Button variant="outline" onClick={loadOpenShift}>
            Reintentar
          </Button>
        </div>
      )
    }

    if (!openShift) {
      return (
        <div className="cash-shift-page__card">
          <p className="cash-shift-page__meta-label">No hay turno abierto</p>
          <form onSubmit={handleOpenShift} noValidate className="cash-shift-page__form">
            {userBranches.length > 1 && (
              <div className="ui-field">
                <label className="ui-field__label" htmlFor="shift-branch">
                  Sede
                </label>
                <select
                  id="shift-branch"
                  className={`ui-field__control${openBranchError ? ' ui-field__control--invalid' : ''}`}
                  value={openBranchId}
                  onChange={(e) => setOpenBranchId(e.target.value)}
                >
                  <option value="">— Elige una sede —</option>
                  {userBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {openBranchError && (
                  <span role="alert" className="ui-field__error">
                    {openBranchError}
                  </span>
                )}
              </div>
            )}
            <div className="cash-shift-page__form-row">
              <TextField
                id="opening-amount"
                label="Monto de apertura"
                type="text"
                inputMode="decimal"
                placeholder="50000.00"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                error={openAmountError}
                hint="Dinero físico al iniciar el turno (use punto decimal)"
              />
            </div>
            <TextAreaField
              id="open-observation"
              label="Observación (opcional)"
              placeholder="Novedades al abrir el turno..."
              value={openObservation}
              onChange={(e) => setOpenObservation(e.target.value)}
              maxLength={OBSERVATION_MAX}
              length={openObservation.length}
              rows={2}
            />
            {openError && <Alert tone="error">{openError}</Alert>}
            <div className="cash-shift-page__form-actions">
              <Button type="submit" disabled={submittingOpen}>
                {submittingOpen ? 'Abriendo turno...' : 'Abrir turno'}
              </Button>
            </div>
          </form>
        </div>
      )
    }

    return (
      <div className="cash-shift-page__card">
        <div className="cash-shift-page__shift-meta">
          <div className="cash-shift-page__meta-item">
            <p className="cash-shift-page__meta-label">Estado</p>
            <span className="cash-shift-page__badge cash-shift-page__badge--open">Abierto</span>
          </div>
          <div className="cash-shift-page__meta-item">
            <p className="cash-shift-page__meta-label">Sede</p>
            <p className="cash-shift-page__meta-value">{openShift.branch.name}</p>
          </div>
          <div className="cash-shift-page__meta-item">
            <p className="cash-shift-page__meta-label">Apertura</p>
            <p className="cash-shift-page__meta-value">{formatDateTime(openShift.openedAt)}</p>
          </div>
          <div className="cash-shift-page__meta-item">
            <p className="cash-shift-page__meta-label">Monto apertura</p>
            <p className="cash-shift-page__meta-value cash-shift-page__amount">
              {formatCOP(openShift.openingAmount)}
            </p>
          </div>
        </div>

        {openShift.observation && (
          <p className="cash-shift-page__meta-value" style={{ fontSize: '0.84rem' }}>
            <span className="cash-shift-page__meta-label">Obs. apertura: </span>
            {openShift.observation}
          </p>
        )}

        <hr className="cash-shift-page__divider" />

        <form onSubmit={handleCloseShift} noValidate className="cash-shift-page__form">
          <div className="cash-shift-page__form-row">
            <TextField
              id="closing-amount"
              label="Monto de cierre"
              type="text"
              inputMode="decimal"
              placeholder="380000.00"
              value={closingAmount}
              onChange={(e) => setClosingAmount(e.target.value)}
              error={closingAmountError}
              hint="Dinero físico contado al cerrar el turno"
            />
          </div>

          {difference !== null && (
            <div className="cash-shift-page__difference">
              <p className="cash-shift-page__difference-label">Diferencia respecto al monto de apertura</p>
              <p
                className={`cash-shift-page__difference-value ${
                  difference > 0
                    ? 'cash-shift-page__difference-value--positive'
                    : difference < 0
                      ? 'cash-shift-page__difference-value--negative'
                      : 'cash-shift-page__difference-value--zero'
                }`}
              >
                {difference === 0
                  ? 'Sin diferencia'
                  : `${difference > 0 ? '+' : '−'} ${formatCOP(String(Math.abs(difference)))}`}
              </p>
            </div>
          )}

          <TextAreaField
            id="close-observation"
            label="Observación de cierre (opcional)"
            placeholder="Novedades al cerrar el turno..."
            value={closeObservation}
            onChange={(e) => setCloseObservation(e.target.value)}
            maxLength={OBSERVATION_MAX}
            length={closeObservation.length}
            rows={2}
          />

          {closeError && <Alert tone="error">{closeError}</Alert>}

          <div className="cash-shift-page__form-actions">
            <Button type="submit" variant="danger" disabled={submittingClose}>
              {submittingClose ? 'Cerrando turno...' : 'Cerrar turno'}
            </Button>
          </div>
        </form>
      </div>
    )
  }

  const renderHistory = () => {
    if (historyStatus === 'loading') {
      return <TableSkeleton label="Cargando historial de turnos..." rows={5} columns={5} />
    }
    if (historyStatus === 'error') {
      return (
        <div className="inventory-page__feedback inventory-page__feedback--inset">
          <Alert tone="error">{historyError}</Alert>
          <Button variant="outline" onClick={loadHistory}>
            Reintentar
          </Button>
        </div>
      )
    }
    if (historyShifts.length === 0) {
      const hasFilters = filters.estado !== 'todos' || filters.desde !== '' || filters.hasta !== ''
      return hasFilters ? (
        <EmptyState
          variant="sin-resultados"
          title="Ningún turno coincide con los filtros"
          description="Cambia el estado o el rango de fechas para ver resultados."
          onClearFilters={() => {
            setFilter('estado', 'todos')
            setFilter('desde', '')
            setFilter('hasta', '')
          }}
        />
      ) : (
        <EmptyState
          variant="sin-registros"
          title="Todavía no hay turnos registrados"
          description="Los turnos de caja se muestran aquí una vez creados."
        />
      )
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="cash-shift-page__table" aria-label="Historial de turnos de caja">
          <thead>
            <tr>
              <th scope="col">Apertura</th>
              <th scope="col">Sede</th>
              <th scope="col">Estado</th>
              <th scope="col">Apertura $</th>
              <th scope="col">Cierre $</th>
            </tr>
          </thead>
          <tbody>
            {historyShifts.map((shift) => (
              <tr key={shift.id}>
                <td>{formatDateTime(shift.openedAt)}</td>
                <td>{shift.branch.name}</td>
                <td>
                  <span
                    className={`cash-shift-page__badge cash-shift-page__badge--${shift.status === 'OPEN' ? 'open' : 'closed'}`}
                  >
                    {shift.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                  </span>
                </td>
                <td className="cash-shift-page__amount">{formatCOP(shift.openingAmount)}</td>
                <td className="cash-shift-page__amount">{formatCOP(shift.closingAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <AppLayout title="Turno de caja">
      {isBranchRole && (
        <section className="cash-shift-page__current" aria-labelledby="current-shift-title">
          <div className="cash-shift-page__section-head">
            <h2 id="current-shift-title" className="cash-shift-page__section-title">
              {openShift ? 'Turno activo' : 'Abrir turno'}
            </h2>
          </div>
          {renderCurrentShift()}
        </section>
      )}

      <section className="cash-shift-page__history" aria-labelledby="shift-history-title">
        <div className="cash-shift-page__section-head">
          <h2 id="shift-history-title" className="cash-shift-page__section-title">
            Historial de turnos
          </h2>
          <div className="inventory-page__toolbar" style={{ marginBottom: 0 }}>
            <label className="sr-only" htmlFor="shift-status-filter">
              Filtrar por estado
            </label>
            <select
              id="shift-status-filter"
              className="inventory-page__filter"
              value={filters.estado}
              onChange={(e) => setFilter('estado', e.target.value)}
            >
              <option value="todos">Todos los estados</option>
              <option value="OPEN">Abiertos</option>
              <option value="CLOSED">Cerrados</option>
            </select>
            <label className="closure-page__date">
              <span>Desde</span>
              <input
                type="date"
                className="inventory-page__filter"
                value={filters.desde}
                onChange={(e) => setFilter('desde', e.target.value)}
              />
            </label>
            <label className="closure-page__date">
              <span>Hasta</span>
              <input
                type="date"
                className="inventory-page__filter"
                value={filters.hasta}
                onChange={(e) => setFilter('hasta', e.target.value)}
              />
            </label>
            <ReloadButton onReload={loadHistory} loading={historyStatus === 'loading'} />
          </div>
        </div>
        <div className="cash-shift-page__history-card">{renderHistory()}</div>
        <div className="inventory-page__footer">
          {historyStatus === 'idle' && historyMeta && (
            <Pagination
              page={historyMeta.page}
              totalPages={historyMeta.totalPages}
              total={historyMeta.total}
              limit={params.limit}
              limitOptions={limitOptions}
              label="Paginación de turnos"
              onChange={setPage}
              onLimitChange={setLimit}
            />
          )}
        </div>
      </section>
    </AppLayout>
  )
}

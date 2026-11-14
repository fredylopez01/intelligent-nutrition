import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { useDashboardEmbed } from '../../hooks/useDashboardEmbed'
import { AppLayout } from '../../layouts/AppLayout'

import './BiDashboardPage.css'

// Looker Studio generates the iframe code itself. These attributes must match the code
// recorded by the proof of concept (TK-133-03): they let Google open its sign-in popup and
// keep its own storage access inside the frame.
const IFRAME_SANDBOX =
  'allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'

export function BiDashboardPage() {
  const { status, url, error, refetch } = useDashboardEmbed()

  const renderReport = () => {
    if (status === 'loading') {
      return (
        <div className="bi-dashboard__skeleton" aria-busy="true" aria-live="polite">
          <span className="sr-only">Cargando el dashboard...</span>
          <span className="bi-dashboard__skeleton-block" aria-hidden="true" />
        </div>
      )
    }
    if (status === 'error' || !url) {
      return (
        <div className="bi-dashboard__feedback">
          <Alert tone="error">
            {error ?? 'No fue posible cargar el dashboard. Intenta de nuevo.'}
          </Alert>
          <Button variant="outline" onClick={refetch}>
            Reintentar
          </Button>
        </div>
      )
    }
    return (
      <iframe
        className="bi-dashboard__frame"
        title="Dashboard de ventas, compras e inventario"
        src={url}
        sandbox={IFRAME_SANDBOX}
        allowFullScreen
      />
    )
  }

  return (
    <AppLayout title="Dashboard">
      <div className="bi-dashboard__toolbar">
        <p className="bi-dashboard__note">
          Para ver el informe debes haber iniciado sesión en Google con una cuenta autorizada.
        </p>
        {status === 'success' && url && (
          <a className="bi-dashboard__link" href={url} target="_blank" rel="noopener noreferrer">
            Abrir en una pestaña nueva
          </a>
        )}
      </div>

      <div className="bi-dashboard__card">{renderReport()}</div>
    </AppLayout>
  )
}

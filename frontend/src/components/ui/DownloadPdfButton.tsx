import { useState } from 'react'

import { Button } from './Button'

import './DownloadPdfButton.css'

interface DownloadPdfButtonProps {
  label: string
  onDownload: () => Promise<void>
  disabled?: boolean
  variant?: 'outline' | 'primary'
}

export function DownloadPdfButton({
  label,
  onDownload,
  disabled = false,
  variant = 'outline',
}: DownloadPdfButtonProps) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleClick = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await onDownload()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="download-pdf">
      <Button variant={variant} onClick={handleClick} disabled={disabled || busy}>
        <svg className="download-pdf__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" />
        </svg>
        {busy ? 'Generando PDF...' : label}
      </Button>
      {failed && (
        <span className="download-pdf__error" role="alert">
          No se pudo generar el PDF. Intenta de nuevo.
        </span>
      )}
    </span>
  )
}

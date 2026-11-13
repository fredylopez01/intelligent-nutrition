import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DownloadPdfButton } from './DownloadPdfButton'

describe('DownloadPdfButton', () => {
  it('shows the progress while the PDF is generated', async () => {
    let finish: () => void = () => undefined
    const onDownload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const user = userEvent.setup()
    render(<DownloadPdfButton label="Descargar PDF" onDownload={onDownload} />)

    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    expect(screen.getByRole('button', { name: 'Generando PDF...' })).toBeDisabled()
    finish()

    expect(await screen.findByRole('button', { name: 'Descargar PDF' })).toBeEnabled()
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it('explains when the PDF could not be generated', async () => {
    const user = userEvent.setup()
    render(
      <DownloadPdfButton label="Descargar PDF" onDownload={() => Promise.reject(new Error('x'))} />,
    )

    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo generar el PDF.')
  })
})

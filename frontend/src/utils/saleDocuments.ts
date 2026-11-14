import type { Sale } from '../types/sale'

export function isInvoice(sale: Sale): boolean {
  return Boolean(sale.customer?.documentNumber)
}

export function receiptButtonLabel(sale: Sale): string {
  return isInvoice(sale) ? 'Descargar factura' : 'Descargar comprobante'
}

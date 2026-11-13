import type { Sale } from '../../types/sale'
import { formatMovementDate } from '../inventoryMovements'
import { formatPrice } from '../products'
import { SALE_STATUS_LABELS } from '../sales'

import {
  PAGE,
  PDF_COLORS,
  createBrandedPdf,
  fetchBranchContact,
  finishPdf,
  pdfText,
  setColor,
  tableTheme,
} from './brandedPdf'

function money(value: string | number): string {
  return pdfText(formatPrice(value))
}

export function saleReceiptFileName(sale: Sale): string {
  return `comprobante-${sale.saleNumber}.pdf`
}

export async function downloadSaleReceipt(sale: Sale, now = new Date()) {
  const branch = await fetchBranchContact(sale.branch.id)
  const pdf = await createBrandedPdf(
    {
      title: 'Comprobante de venta',
      reference: sale.saleNumber,
      issuer: { name: sale.branch.name, address: branch?.address, phone: branch?.phone },
      meta: [
        ['Fecha de compra', formatMovementDate(sale.saleAt)],
        ['Estado', SALE_STATUS_LABELS[sale.status]],
        ['Atendió', sale.user.fullName],
        ['Cliente', sale.customer?.fullName ?? 'Cliente no identificado'],
      ],
    },
    now,
  )
  const { doc, autoTable } = pdf
  const right = PAGE.width - PAGE.margin
  let y = pdf.cursorY

  if (sale.status === 'REVERSED') {
    doc.setFillColor(253, 236, 236)
    doc.roundedRect(PAGE.margin, y - 4, right - PAGE.margin, 12, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setColor(doc, PDF_COLORS.danger)
    const reversedAt = sale.reversedAt ? ` el ${formatMovementDate(sale.reversedAt)}` : ''
    doc.text(
      pdfText(`Venta reversada${reversedAt}. ${sale.reversalReason ?? ''}`.trim()),
      PAGE.margin + 4,
      y + 3.2,
      { maxWidth: right - PAGE.margin - 8 },
    )
    y += 14
  }

  autoTable(doc, {
    ...tableTheme(),
    startY: y,
    head: [['Producto', 'Cant.', 'Precio', 'Total']],
    body: sale.items.map((item) => [
      pdfText(`${item.productName}\nRef. ${item.referenceCode}`),
      String(item.quantity),
      money(item.unitPrice),
      money(item.total),
    ]),
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 34 },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right'
    },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9
  if (y > PAGE.height - 75) {
    doc.addPage()
    y = PAGE.margin + 6
  }

  const totals: [string, string][] = [['Subtotal', money(sale.subtotal)]]
  if (Number(sale.discountAmount) > 0) {
    totals.push([
      sale.discountReason ? `Descuentos (${sale.discountReason})` : 'Descuentos',
      `-${money(sale.discountAmount)}`,
    ])
  }
  if (Number(sale.promotionDiscount ?? 0) > 0) {
    totals.push(['Promoción', `-${money(sale.promotionDiscount ?? 0)}`])
  }
  if (Number(sale.taxAmount) > 0) totals.push(['Impuestos', money(sale.taxAmount)])

  const totalsX = right - 78
  let totalsY = y
  doc.setFontSize(9)
  for (const [label, value] of totals) {
    doc.setFont('helvetica', 'normal')
    setColor(doc, PDF_COLORS.muted)
    doc.text(pdfText(label), totalsX, totalsY, { maxWidth: 46 })
    setColor(doc, PDF_COLORS.ink)
    doc.text(value, right, totalsY, { align: 'right' })
    totalsY += 6
  }
  doc.setDrawColor(...PDF_COLORS.ink)
  doc.setLineWidth(0.4)
  doc.line(totalsX, totalsY - 2.5, right, totalsY - 2.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setColor(doc, PDF_COLORS.ink)
  doc.text('Total', totalsX, totalsY + 4)
  doc.setFontSize(14)
  setColor(doc, PDF_COLORS.brand)
  doc.text(money(sale.total), right, totalsY + 4.5, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setColor(doc, PDF_COLORS.ink)
  doc.text('Pagos', PAGE.margin, y)
  let paymentY = y + 6
  doc.setFont('helvetica', 'normal')
  for (const payment of sale.payments) {
    setColor(doc, PDF_COLORS.muted)
    const label = `${payment.paymentMethod.name}${payment.reference ? ` · ref. ${payment.reference}` : ''}`
    doc.text(pdfText(label), PAGE.margin, paymentY, { maxWidth: 70 })
    setColor(doc, PDF_COLORS.ink)
    doc.text(money(payment.amount), PAGE.margin + 90, paymentY, { align: 'right' })
    paymentY += 6
  }

  const thanksY = Math.max(totalsY + 20, paymentY + 10)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setColor(doc, PDF_COLORS.ink)
  doc.text('Gracias por tu compra.', PAGE.margin, thanksY)

  finishPdf(pdf, saleReceiptFileName(sale), [
    'Comprobante interno de venta. No reemplaza la factura electrónica.',
  ])
}

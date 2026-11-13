import type { RestockReportRow, SalesReportRow } from '../../types/report'
import { formatLongDate } from '../format'
import { formatExpirationDate } from '../inventory'
import { formatPrice } from '../products'
import { summarizeSalesReport } from '../reports'
import { toCents } from '../sales'

import {
  PAGE,
  PDF_COLORS,
  createBrandedPdf,
  drawSummaryBoxes,
  fetchBranchContact,
  finishPdf,
  pdfText,
  setColor,
  tableTheme,
} from './brandedPdf'

export interface ReportBranch {
  id: string
  name: string
}

function money(cents: number): string {
  return pdfText(formatPrice(cents / 100))
}

async function issuerFor(branch: ReportBranch | null) {
  if (!branch) return { name: 'Todas las sedes', address: 'Consolidado de las sedes activas' }
  const contact = await fetchBranchContact(branch.id)
  return { name: branch.name, address: contact?.address, phone: contact?.phone }
}

function lastTableY(doc: unknown): number {
  return (doc as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

export function salesReportFileName(from: string, to: string): string {
  return `reporte-ventas-${from}-a-${to}.pdf`
}

export async function downloadSalesReport(
  {
    rows,
    branch,
    from,
    to,
  }: { rows: SalesReportRow[]; branch: ReportBranch | null; from: string; to: string },
  now = new Date(),
) {
  const summary = summarizeSalesReport(rows)
  const pdf = await createBrandedPdf(
    {
      title: 'Reporte de ventas',
      reference: `${formatExpirationDate(from)} - ${formatExpirationDate(to)}`,
      issuer: await issuerFor(branch),
      meta: [
        ['Período', `${formatLongDate(from)} al ${formatLongDate(to)}`],
        ['Sede', branch?.name ?? 'Todas las sedes'],
      ],
    },
    now,
  )
  const { doc, autoTable } = pdf
  const y = drawSummaryBoxes(
    doc,
    [
      ['Total vendido', money(summary.totalCents)],
      ['Ventas', String(summary.salesCount)],
      ['Ticket promedio', money(summary.averageCents)],
    ],
    pdf.cursorY,
  )

  const showBranch = !branch
  const head = [
    'Día',
    ...(showBranch ? ['Sede'] : []),
    'Ventas',
    'Ticket promedio',
    'Total vendido',
  ]
  autoTable(doc, {
    ...tableTheme(),
    startY: y + 8,
    head: [head],
    body: rows.map((row) => {
      const totalCents = toCents(row.totalAmount)
      const average = row.salesCount > 0 ? Math.round(totalCents / row.salesCount) : 0
      return [
        formatExpirationDate(row.day),
        ...(showBranch ? [pdfText(row.branch.name)] : []),
        String(row.salesCount),
        money(average),
        money(totalCents),
      ]
    }),
    foot: [
      [
        'Total',
        ...(showBranch ? [''] : []),
        String(summary.salesCount),
        money(summary.averageCents),
        money(summary.totalCents),
      ],
    ],
    showFoot: 'lastPage',
    didParseCell: (data) => {
      if (data.column.index >= head.length - 3) data.cell.styles.halign = 'right'
    },
  })

  if (rows.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setColor(doc, PDF_COLORS.muted)
    doc.text('No hay ventas completadas en este período.', PAGE.margin, lastTableY(doc) + 8)
  }

  finishPdf(pdf, salesReportFileName(from, to), [
    'Incluye solo ventas completadas. Las ventas reversadas no suman.',
  ])
}

export function restockReportFileName(branch: ReportBranch | null, today: string): string {
  const scope = branch ? branch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'todas-las-sedes'
  return `reposicion-${scope}-${today}.pdf`.replace(/-+/g, '-')
}

export async function downloadRestockReport(
  { rows, branch, today }: { rows: RestockReportRow[]; branch: ReportBranch | null; today: string },
  now = new Date(),
) {
  const suggested = rows.reduce((sum, row) => sum + row.suggestedUnits, 0)
  const pdf = await createBrandedPdf(
    {
      title: 'Reposición sugerida',
      reference: formatExpirationDate(today),
      issuer: await issuerFor(branch),
      meta: [
        ['Sede', branch?.name ?? 'Todas las sedes'],
        ['Fecha del reporte', formatLongDate(today)],
      ],
    },
    now,
  )
  const { doc, autoTable } = pdf
  const y = drawSummaryBoxes(
    doc,
    [
      ['Productos por reponer', String(rows.length)],
      ['Unidades sugeridas', `${suggested} und`],
    ],
    pdf.cursorY,
  )

  const showBranch = !branch
  const head = [
    'Producto',
    ...(showBranch ? ['Sede'] : []),
    'Actual',
    'Mínimo',
    'Demanda 7 días',
    'Reponer',
  ]
  autoTable(doc, {
    ...tableTheme(),
    startY: y + 8,
    head: [head],
    body: rows.map((row) => [
      pdfText(`${row.name}\nRef. ${row.referenceCode}`),
      ...(showBranch ? [pdfText(row.branchName)] : []),
      String(row.currentQuantity),
      String(row.minimumStock),
      String(row.projectedDemand7d),
      `${row.suggestedUnits} und`,
    ]),
    didParseCell: (data) => {
      if (data.column.index >= head.length - 4) data.cell.styles.halign = 'right'
      if (data.section === 'body' && data.column.index === head.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = PDF_COLORS.brand
      }
    },
  })

  if (rows.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setColor(doc, PDF_COLORS.muted)
    doc.text(
      'Ningún producto está por debajo de su stock mínimo.',
      PAGE.margin,
      lastTableY(doc) + 8,
    )
  }

  finishPdf(pdf, restockReportFileName(branch, today), [
    'La demanda de 7 días proyecta el promedio diario de ventas de los últimos 30 días.',
  ])
}

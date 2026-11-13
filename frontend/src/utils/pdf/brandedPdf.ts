import type { jsPDF } from 'jspdf'

import logoUrl from '../../assets/logo-intelligent-nutrition-light.png'
import { http } from '../../services/http'

type Rgb = [number, number, number]

export const PDF_COLORS: Record<
  'ink' | 'muted' | 'faint' | 'line' | 'soft' | 'brand' | 'danger',
  Rgb
> = {
  ink: [24, 20, 20],
  muted: [102, 96, 96],
  faint: [150, 144, 144],
  line: [226, 222, 222],
  soft: [247, 245, 245],
  brand: [214, 26, 26],
  danger: [176, 24, 24],
}

export const PAGE = { width: 210, height: 297, margin: 16 }

const generatedFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
})

export interface PdfIssuer {
  name: string
  address?: string | null
  phone?: string | null
}

export interface PdfHeader {
  title: string
  reference?: string
  issuer: PdfIssuer
  meta: [string, string][]
}

export interface BrandedPdf {
  doc: jsPDF
  autoTable: typeof import('jspdf-autotable').autoTable
  cursorY: number
  generatedAt: string
}

export function pdfText(value: string): string {
  return value
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[\u2212\u2013]/g, '-')
    .replace(/\s+·\s+/g, ' · ')
}

export function formatGeneratedAt(now = new Date()): string {
  return generatedFormatter.format(now)
}

function contactLine(): string {
  const env = import.meta.env
  const phone = (env.VITE_CONTACT_WHATSAPP ?? '').replace(/\D/g, '')
  const email = (env.VITE_CONTACT_EMAIL ?? '').trim()
  const formattedPhone =
    phone.length === 10 ? `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}` : phone
  return ['Intelligent Nutrition', formattedPhone && `WhatsApp ${formattedPhone}`, email]
    .filter(Boolean)
    .join('  ·  ')
}

const LOGO_MAX_WIDTH_PX = 520

async function loadLogo(): Promise<{ data: string; ratio: number } | null> {
  try {
    const image = new Image()
    image.src = logoUrl
    await image.decode()
    const scale = Math.min(1, LOGO_MAX_WIDTH_PX / image.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return { data: canvas.toDataURL('image/png'), ratio: canvas.width / canvas.height }
  } catch {
    return null
  }
}

export async function fetchBranchContact(
  branchId: string,
): Promise<{ address: string; phone: string } | null> {
  try {
    const branch = await http.get<{ address: string; phone: string }>(`/branches/${branchId}`)
    return { address: branch.address, phone: branch.phone }
  } catch {
    return null
  }
}

export function setColor(doc: jsPDF, color: Rgb) {
  doc.setTextColor(color[0], color[1], color[2])
}

export async function createBrandedPdf(header: PdfHeader, now = new Date()): Promise<BrandedPdf> {
  const [{ jsPDF: JsPdf }, { autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadLogo(),
  ])
  const doc = new JsPdf({ unit: 'mm', format: 'a4' })
  const { margin, width } = PAGE
  const right = width - margin
  const generatedAt = formatGeneratedAt(now)

  doc.setFillColor(...PDF_COLORS.brand)
  doc.rect(0, 0, width, 2.2, 'F')

  if (logo && logo.ratio > 0) {
    const logoWidth = Math.min(54, logo.ratio * 11)
    doc.addImage(logo.data, 'PNG', margin, 13, logoWidth, logoWidth / logo.ratio, 'logo', 'FAST')
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    setColor(doc, PDF_COLORS.ink)
    doc.text('INTELLIGENT NUTRITION', margin, 21)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  setColor(doc, PDF_COLORS.ink)
  doc.text(pdfText(header.title), right, 19, { align: 'right' })
  if (header.reference) {
    doc.setFont('courier', 'bold')
    doc.setFontSize(11)
    setColor(doc, PDF_COLORS.muted)
    doc.text(pdfText(header.reference), right, 25.5, { align: 'right' })
  }

  const blockTop = 38
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setColor(doc, PDF_COLORS.ink)
  doc.text(pdfText(header.issuer.name), margin, blockTop)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setColor(doc, PDF_COLORS.muted)
  let issuerY = blockTop + 5
  for (const line of [
    header.issuer.address,
    header.issuer.phone && `Tel. ${header.issuer.phone}`,
  ]) {
    if (!line) continue
    const wrapped = doc.splitTextToSize(pdfText(line), 85) as string[]
    doc.text(wrapped, margin, issuerY)
    issuerY += wrapped.length * 4.2
  }

  let metaY = blockTop
  for (const [label, value] of header.meta) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setColor(doc, PDF_COLORS.faint)
    doc.text(pdfText(label.toUpperCase()), right - 88, metaY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    setColor(doc, PDF_COLORS.ink)
    const wrapped = doc.splitTextToSize(pdfText(value), 54) as string[]
    doc.text(wrapped, right, metaY, { align: 'right' })
    metaY += Math.max(1, wrapped.length) * 4.4 + 1.2
  }

  const ruleY = Math.max(issuerY, metaY) + 2
  doc.setDrawColor(...PDF_COLORS.line)
  doc.setLineWidth(0.3)
  doc.line(margin, ruleY, right, ruleY)

  return { doc, autoTable, cursorY: ruleY + 7, generatedAt }
}

export function drawSummaryBoxes(doc: jsPDF, items: [string, string][], y: number): number {
  const { margin, width } = PAGE
  const gap = 4
  const boxWidth = (width - margin * 2 - gap * (items.length - 1)) / items.length
  items.forEach(([label, value], index) => {
    const x = margin + index * (boxWidth + gap)
    doc.setFillColor(...PDF_COLORS.soft)
    doc.setDrawColor(...PDF_COLORS.line)
    doc.roundedRect(x, y, boxWidth, 19, 2, 2, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setColor(doc, PDF_COLORS.faint)
    doc.text(pdfText(label.toUpperCase()), x + 4.5, y + 6.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    setColor(doc, PDF_COLORS.ink)
    doc.text(pdfText(value), x + 4.5, y + 14.5)
  })
  return y + 19
}

export function tableTheme() {
  return {
    theme: 'plain' as const,
    margin: { left: PAGE.margin, right: PAGE.margin, bottom: 30 },
    styles: {
      font: 'helvetica',
      fontSize: 8.8,
      cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 },
      textColor: PDF_COLORS.ink,
      lineColor: PDF_COLORS.line,
    },
    headStyles: {
      fillColor: PDF_COLORS.ink,
      textColor: [255, 255, 255] as Rgb,
      fontStyle: 'bold' as const,
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: PDF_COLORS.soft },
    footStyles: {
      fillColor: [255, 255, 255] as Rgb,
      textColor: PDF_COLORS.ink,
      fontStyle: 'bold' as const,
      lineWidth: { top: 0.4 },
      lineColor: PDF_COLORS.ink,
    },
  }
}

export function finishPdf(pdf: BrandedPdf, fileName: string, notes: string[] = []) {
  const { doc, generatedAt } = pdf
  const pages = doc.getNumberOfPages()
  const footerY = PAGE.height - 10
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    const lines = [...notes, contactLine(), `Generado el ${generatedAt}`]
    const ruleY = footerY - lines.length * 3.6 - 2.4
    doc.setDrawColor(...PDF_COLORS.line)
    doc.setLineWidth(0.3)
    doc.line(PAGE.margin, ruleY, PAGE.width - PAGE.margin, ruleY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setColor(doc, PDF_COLORS.faint)
    lines.forEach((line, index) => {
      doc.text(pdfText(line), PAGE.margin, footerY - (lines.length - 1 - index) * 3.6)
    })
    doc.text(`Página ${page} de ${pages}`, PAGE.width - PAGE.margin, footerY, { align: 'right' })
  }
  doc.save(fileName)
}

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '../../services/http'
import { createFakePdf } from '../../test-utils/fakePdf'

import { downloadRestockReport, downloadSalesReport, restockReportFileName } from './reportsPdf'

const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakePdf> | null }))

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(function () {
    return fake.current?.doc
  }),
}))

vi.mock('jspdf-autotable', () => ({
  autoTable: (doc: unknown, options: unknown) =>
    fake.current?.autoTable(doc, options as Parameters<typeof fake.current.autoTable>[1]),
}))

vi.mock('../../services/http', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/http')>()
  return { ...original, http: { get: vi.fn() } }
})

const centro = { id: 'centro', name: 'Centro' }
const norte = { id: 'norte', name: 'Norte' }

beforeEach(() => {
  vi.mocked(http.get).mockResolvedValue({ address: 'Calle 10 # 5-20, Tunja', phone: '3001' })
  fake.current = createFakePdf()
})

describe('reports PDF', () => {
  it('exports every branch of the period with the totals', async () => {
    await downloadSalesReport({
      rows: [
        { day: '2026-11-12', branch: centro, salesCount: 2, totalAmount: '300000.00' },
        { day: '2026-11-11', branch: norte, salesCount: 1, totalAmount: '150000.00' },
      ],
      branch: null,
      from: '2026-11-01',
      to: '2026-11-12',
    })

    const pdf = fake.current!
    expect(http.get).not.toHaveBeenCalled()
    expect(pdf.saved).toEqual(['reporte-ventas-2026-11-01-a-2026-11-12.pdf'])
    expect(pdf.texts).toEqual(
      expect.arrayContaining([
        'Reporte de ventas',
        'Todas las sedes',
        'TOTAL VENDIDO',
        '$ 450.000',
      ]),
    )
    const [table] = pdf.tables
    expect(table.head).toEqual([['Día', 'Sede', 'Ventas', 'Ticket promedio', 'Total vendido']])
    expect(table.body?.[0]).toEqual(['12 nov 2026', 'Centro', '2', '$ 150.000', '$ 300.000'])
    expect(table.foot).toEqual([['Total', '', '3', '$ 150.000', '$ 450.000']])
  })

  it('uses the branch address and hides the branch column for one branch', async () => {
    await downloadSalesReport({
      rows: [{ day: '2026-11-12', branch: centro, salesCount: 1, totalAmount: '99000.00' }],
      branch: centro,
      from: '2026-11-12',
      to: '2026-11-12',
    })

    const pdf = fake.current!
    expect(http.get).toHaveBeenCalledWith('/branches/centro')
    expect(pdf.texts).toContain('Calle 10 # 5-20, Tunja')
    expect(pdf.tables[0].head?.[0]).not.toContain('Sede')
  })

  it('exports the restock suggestion', async () => {
    await downloadRestockReport({
      rows: [
        {
          productId: 'p-1',
          name: 'Whey 2 lb',
          referenceCode: 'WHEY',
          branchId: 'centro',
          branchName: 'Centro',
          currentQuantity: 3,
          minimumStock: 8,
          deficit: -5,
          projectedDemand7d: 4,
          suggestedUnits: 5,
        },
      ],
      branch: centro,
      today: '2026-11-13',
    })

    const pdf = fake.current!
    expect(pdf.saved).toEqual(['reposicion-centro-2026-11-13.pdf'])
    expect(pdf.texts).toEqual(expect.arrayContaining(['Reposición sugerida', '5 und']))
    expect(pdf.tables[0].body).toEqual([['Whey 2 lb\nRef. WHEY', '3', '8', '4', '5 und']])
  })

  it('names the restock file safely', () => {
    expect(
      restockReportFileName({ id: 'b', name: 'Intelligent Nutrition - Bogotá' }, '2026-11-13'),
    ).toBe('reposicion-intelligent-nutrition-bogot-2026-11-13.pdf')
    expect(restockReportFileName(null, '2026-11-13')).toBe(
      'reposicion-todas-las-sedes-2026-11-13.pdf',
    )
  })
})

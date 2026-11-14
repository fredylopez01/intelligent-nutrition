import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '../../services/http'
import { createFakePdf } from '../../test-utils/fakePdf'
import type { Sale } from '../../types/sale'

import { downloadSaleReceipt } from './saleReceiptPdf'

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

const sale: Sale = {
  id: 'sale-1',
  saleNumber: 'V-20261113-0002',
  status: 'COMPLETED',
  branch: { id: 'bogota', name: 'Intelligent Nutrition - Bogotá' },
  user: { id: 'u-1', fullName: 'Laura Restrepo' },
  customer: null,
  saleAt: '2026-11-13T15:30:00.000Z',
  subtotal: '569700.00',
  discountAmount: '0.00',
  taxAmount: '0.00',
  total: '452911.50',
  reversalReason: null,
  reversedAt: null,
  promotionDiscount: '116788.50',
  items: [
    {
      productId: 'p-1',
      productName: 'Proteína Whey Chocolate 2 lb',
      referenceCode: 'PRO-WHEY-CHO-2LB',
      quantity: 3,
      unitPrice: '189900.00',
      subtotal: '569700.00',
      discountAmount: '0.00',
      taxAmount: '0.00',
      total: '569700.00',
    },
  ],
  payments: [
    {
      paymentMethod: { id: 'cash', code: 'CASH', name: 'Efectivo' },
      amount: '452911.50',
      reference: null,
      paidAt: '2026-11-13T15:30:00.000Z',
    },
  ],
}

beforeEach(() => {
  vi.mocked(http.get).mockResolvedValue({
    address: 'Calle 93 # 15-20, Bogotá',
    phone: '6015552001',
  })
  fake.current = createFakePdf()
})

describe('downloadSaleReceipt', () => {
  it('builds the receipt with the branch address, the items, the totals and the payments', async () => {
    await downloadSaleReceipt(sale, new Date('2026-11-13T19:15:00.000Z'))

    const pdf = fake.current!
    expect(http.get).toHaveBeenCalledWith('/branches/bogota')
    expect(pdf.saved).toEqual(['comprobante-V-20261113-0002.pdf'])
    expect(pdf.texts).toEqual(
      expect.arrayContaining([
        'Comprobante de venta',
        'V-20261113-0002',
        'Calle 93 # 15-20, Bogotá',
        'Tel. 6015552001',
        'Cliente no identificado',
        'Promoción',
        'Total',
        'Gracias por tu compra.',
        'Comprobante interno de venta. No reemplaza la factura electrónica.',
      ]),
    )
    expect(pdf.texts.some((text) => /^Generado el 13 de noviembre de 2026/.test(text))).toBe(true)
    expect(pdf.texts.some((text) => text.includes('WhatsApp'))).toBe(false)
    expect(pdf.tables[0].head).toEqual([['Producto', 'Cant.', 'Precio', 'Total']])
    expect(pdf.tables[0].body?.[0][0]).toBe('Proteína Whey Chocolate 2 lb\nRef. PRO-WHEY-CHO-2LB')
    expect(pdf.texts.some((text) => /^-\$ 116\.788,50$/.test(text))).toBe(true)
    expect(pdf.texts.every((text) => !/[\u00a0\u202f\u2212]/.test(text))).toBe(true)
  })

  it('marks a reversed sale and still works without the branch address', async () => {
    vi.mocked(http.get).mockRejectedValue(new Error('offline'))

    await downloadSaleReceipt({
      ...sale,
      status: 'REVERSED',
      reversalReason: 'Cliente devolvió el producto',
      reversedAt: '2026-11-13T16:00:00.000Z',
    })

    const pdf = fake.current!
    expect(pdf.texts).toContain('Reversada')
    expect(pdf.texts.some((text) => text.startsWith('Venta reversada el'))).toBe(true)
    expect(pdf.texts.some((text) => text.startsWith('Tel.'))).toBe(false)
  })

  it('prints an invoice with the customer data when the sale has a registered customer', async () => {
    await downloadSaleReceipt({
      ...sale,
      customer: {
        id: 'c-1',
        fullName: 'Laura Pérez',
        documentType: { code: 'CC', name: 'Cédula de ciudadanía' },
        documentNumber: '1049000111',
        email: 'laura@correo.com',
        phone: '3001112233',
        address: 'Calle 20 # 10-15, Tunja',
        isCompany: false,
      },
    })

    const pdf = fake.current!
    expect(pdf.saved).toEqual(['factura-V-20261113-0002.pdf'])
    expect(pdf.texts).toEqual(
      expect.arrayContaining([
        'Factura de venta',
        'DATOS DEL CLIENTE',
        'Laura Pérez',
        'CC 1049000111',
        'laura@correo.com',
        'Calle 20 # 10-15, Tunja',
      ]),
    )
    expect(pdf.texts).not.toContain('Cliente no identificado')
    expect(pdf.texts.some((text) => text.includes('validada como factura electrónica'))).toBe(true)
  })
})

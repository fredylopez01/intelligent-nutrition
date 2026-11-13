import { vi } from 'vitest'

export interface FakeTable {
  head?: string[][]
  body?: string[][]
  foot?: string[][]
}

export function createFakePdf() {
  const texts: string[] = []
  const tables: FakeTable[] = []
  const saved: string[] = []
  const doc = {
    lastAutoTable: { finalY: 120 },
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    line: vi.fn(),
    addImage: vi.fn(),
    addPage: vi.fn(),
    setPage: vi.fn(),
    getNumberOfPages: () => 1,
    splitTextToSize: (text: string) => [text],
    text: (value: string | string[]) => {
      texts.push(...(Array.isArray(value) ? value : [value]))
    },
    save: (name: string) => {
      saved.push(name)
    },
  }
  const autoTable = (_doc: unknown, options: FakeTable) => {
    tables.push(options)
  }
  return { doc, autoTable, texts, tables, saved }
}

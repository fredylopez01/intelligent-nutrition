import type { Branch } from '../types/branch'

const listFormatter = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' })

type LoadStatus = 'loading' | 'success' | 'error'

export function landingBranchName(name: string): string {
  return name
    .replace(/^Intelligent Nutrition\s*-\s*/i, '')
    .replace(/^Sede\s+/i, '')
    .trim()
}

export function branchesCountLabel(count: number): string {
  return count === 1 ? '1 sede' : `${count} sedes`
}

export function branchesHighlight(
  status: LoadStatus,
  branches: Branch[],
): { title: string; description: string } {
  const active = branches.filter((branch) => branch.active)
  if (status !== 'success' || active.length === 0) {
    return { title: 'Sedes físicas', description: 'Asesoría en persona en cada sede' }
  }
  return { title: branchesCountLabel(active.length), description: activeBranchNames(active) }
}

export function heroStockLabel(status: LoadStatus, branches: Branch[]): string {
  const count = branches.filter((branch) => branch.active).length
  return status === 'success' && count > 0
    ? `${branchesCountLabel(count)}, un solo stock`
    : 'Todas las sedes, un solo stock'
}

export function activeBranchNames(branches: Branch[]): string {
  return listFormatter.format(
    branches.filter((branch) => branch.active).map((branch) => landingBranchName(branch.name)),
  )
}

export function inventoryTagline(status: LoadStatus, branches: Branch[]): string {
  const count = branches.filter((branch) => branch.active).length
  const scope =
    status === 'success' && count > 0
      ? count === 1
        ? 'una sede'
        : `${count} sedes`
      : 'todas las sedes'
  return `Un solo inventario para ${scope}. Lo que ves en pantalla es lo que hay en el estante.`
}

import type { RoleName } from '../types/auth'

export const ROUTE_ROLES: Record<string, RoleName[]> = {
  '/dashboard': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/sedes': ['SUPERADMIN'],
  '/inventario': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/inventario/consolidado': ['SUPERADMIN'],
  '/inventario/movimientos': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/inventario/cierre': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/catalogo': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/catalogo/categorias': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/catalogo/unidades': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/catalogo/recetas': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/pos': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/pos/ventas': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/pos/metodos-pago': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/clientes': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/proveedores': ['SUPERADMIN', 'BRANCH_LEADER'],
  '/proveedores/compras': ['SUPERADMIN', 'BRANCH_LEADER'],
  '/usuarios': ['SUPERADMIN', 'DEV'],
  '/auditoria': ['SUPERADMIN', 'DEV'],
  '/caja/turno': ['SUPERADMIN', 'BRANCH_LEADER', 'BRANCH_ASSISTANT'],
  '/promociones': ['SUPERADMIN'],
  '/reportes': ['SUPERADMIN', 'BRANCH_LEADER'],
  '/reportes/reposicion': ['SUPERADMIN', 'BRANCH_LEADER'],
}

export function canAccess(path: string, roleName: string | undefined): boolean {
  const roles = ROUTE_ROLES[path]
  if (!roles) return true
  return roleName !== undefined && (roles as string[]).includes(roleName)
}

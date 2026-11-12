export interface PendingModule {
  path: string
  title: string
  description: string
}

export const PENDING_MODULES: PendingModule[] = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    description: 'Ventas del día, stock por sede y alertas de inventario en una sola vista.',
  },
  {
    path: '/perfil',
    title: 'Mi perfil',
    description: 'Consulta y actualiza tus datos personales y de contacto.',
  },
]

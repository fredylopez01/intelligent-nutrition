export interface PendingModule {
  path: string
  title: string
  description: string
}

export const PENDING_MODULES: PendingModule[] = [
  {
    path: '/perfil',
    title: 'Mi perfil',
    description: 'Consulta y actualiza tus datos personales y de contacto.',
  },
]

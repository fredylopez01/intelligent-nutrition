import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useBrandAssets } from '../hooks/useBrandAssets'
import { usePublicBranches } from '../hooks/usePublicBranches'
import { activeBranchNames, inventoryTagline } from '../utils/landing'

import './AuthLayout.css'

interface AuthLayoutProps {
  children: ReactNode
  back?: { to: string; label: string }
  tagline?: string
}

export function AuthLayout({ children, back, tagline }: AuthLayoutProps) {
  const { logo, isotipo } = useBrandAssets()
  const { status, branches } = usePublicBranches()
  const names = status === 'success' ? activeBranchNames(branches) : ''
  return (
    <div className="auth-layout">
      <aside className="auth-layout__brand">
        <div className="auth-layout__brand-glow" aria-hidden="true" />
        <img
          className="auth-layout__mark auth-layout__mark--top"
          src={isotipo}
          alt=""
          aria-hidden="true"
        />
        <img
          className="auth-layout__mark auth-layout__mark--bottom"
          src={isotipo}
          alt=""
          aria-hidden="true"
        />

        <img className="auth-layout__logo" src={logo} alt="Intelligent Nutrition" />

        <div className="auth-layout__brand-copy">
          <p className="auth-layout__tagline">{tagline ?? inventoryTagline(status, branches)}</p>
          {names && <p className="auth-layout__sedes">{names}</p>}
        </div>
      </aside>

      <main className="auth-layout__form">
        {back && (
          <Link to={back.to} className="auth-layout__back">
            {back.label}
          </Link>
        )}
        <div className="auth-layout__form-inner">{children}</div>
      </main>
    </div>
  )
}

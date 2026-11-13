import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { LandingFooter } from './LandingFooter'

const contact = {
  email: 'intelligentnutrition.shop@gmail.com',
  whatsapp: '3102332100',
  instagramUrl: 'https://www.instagram.com/intelligent_nutrition__',
  facebookUrl: 'https://www.facebook.com/profile.php?id=61585427768971',
}

function renderFooter(overrides = {}) {
  render(
    <MemoryRouter>
      <LandingFooter logo="/logo.svg" contact={{ ...contact, ...overrides }} />
    </MemoryRouter>,
  )
}

describe('LandingFooter', () => {
  it('links the WhatsApp, the email and the social networks', () => {
    renderFooter()

    expect(screen.getByRole('link', { name: 'WhatsApp 310 233 2100' })).toHaveAttribute(
      'href',
      'https://wa.me/573102332100',
    )
    expect(
      screen.getByRole('link', { name: 'Correo intelligentnutrition.shop@gmail.com' }),
    ).toHaveAttribute('href', 'mailto:intelligentnutrition.shop@gmail.com')
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute(
      'href',
      contact.instagramUrl,
    )
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
      'href',
      contact.facebookUrl,
    )
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute('target', '_blank')
  })

  it('hides what is not configured', () => {
    renderFooter({ email: '', whatsapp: '', instagramUrl: '', facebookUrl: '' })

    expect(screen.getByText('Escríbenos en cualquiera de nuestras sedes.')).toBeInTheDocument()
    expect(screen.queryByText('Redes sociales')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Términos',
      'Privacidad',
    ])
  })
})

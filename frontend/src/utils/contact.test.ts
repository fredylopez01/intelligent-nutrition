import { describe, expect, it } from 'vitest'

import { formatPhone, readContactInfo, whatsappUrl } from './contact'

describe('contact utils', () => {
  it('reads the contact data from the environment', () => {
    expect(
      readContactInfo({
        VITE_CONTACT_EMAIL: ' tienda@example.com ',
        VITE_CONTACT_WHATSAPP: '310 233-2100',
        VITE_INSTAGRAM_URL: 'https://instagram.com/tienda',
      }),
    ).toEqual({
      email: 'tienda@example.com',
      whatsapp: '3102332100',
      instagramUrl: 'https://instagram.com/tienda',
      facebookUrl: '',
    })
  })

  it('formats the phone and builds the WhatsApp link with the country code', () => {
    expect(formatPhone('3102332100')).toBe('310 233 2100')
    expect(whatsappUrl('3102332100')).toBe('https://wa.me/573102332100')
    expect(whatsappUrl('3102332100', 'Hola, quiero información')).toBe(
      'https://wa.me/573102332100?text=Hola%2C%20quiero%20informaci%C3%B3n',
    )
  })
})

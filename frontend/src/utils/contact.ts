const env = import.meta.env

export interface ContactInfo {
  email: string
  whatsapp: string
  instagramUrl: string
  facebookUrl: string
}

function clean(value: string | undefined): string {
  return value?.trim() ?? ''
}

export function readContactInfo(source: Record<string, string | undefined> = env): ContactInfo {
  return {
    email: clean(source.VITE_CONTACT_EMAIL),
    whatsapp: clean(source.VITE_CONTACT_WHATSAPP).replace(/\D/g, ''),
    instagramUrl: clean(source.VITE_INSTAGRAM_URL),
    facebookUrl: clean(source.VITE_FACEBOOK_URL),
  }
}

export const CONTACT = readContactInfo()

export function formatPhone(phone: string): string {
  return phone.length === 10 ? `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}` : phone
}

export function whatsappUrl(phone: string, message?: string): string {
  const number = phone.length === 10 ? `57${phone}` : phone
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${number}${text}`
}

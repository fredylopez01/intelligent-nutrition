import { Link } from 'react-router-dom'

import { CONTACT, formatPhone, whatsappUrl } from '../../utils/contact'
import type { ContactInfo } from '../../utils/contact'

import './LandingFooter.css'

interface LandingFooterProps {
  logo: string
  contact?: ContactInfo
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20l1.2-3.6A8 8 0 1 1 8 19.1L4 20Z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.4-1.8-.9-.8.8a4 4 0 0 1-2.4-2.4l.8-.8-.9-1.8L9 9.5Z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 8h2.5V4.5H14A4 4 0 0 0 10 8.5V11H7.5v3.5H10V21h3.5v-6.5H16l.5-3.5h-3V9a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

export function LandingFooter({ logo, contact = CONTACT }: LandingFooterProps) {
  const hasContact = Boolean(contact.whatsapp || contact.email)
  const hasSocial = Boolean(contact.instagramUrl || contact.facebookUrl)
  return (
    <footer className="landing__footer" id="contacto">
      <div className="landing__footer-grid">
        <div>
          <img className="landing__footer-logo" src={logo} alt="Intelligent Nutrition" />
          <p className="landing__footer-copy">
            Suplementación deportiva con asesoría, en Tunja y Sogamoso.
          </p>
        </div>
        <div>
          <p className="landing__eyebrow">Contáctanos</p>
          {hasContact ? (
            <ul className="landing-footer__list">
              {contact.whatsapp && (
                <li>
                  <a
                    className="landing-footer__link"
                    href={whatsappUrl(contact.whatsapp)}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`WhatsApp ${formatPhone(contact.whatsapp)}`}
                  >
                    <WhatsAppIcon />
                    <span>{formatPhone(contact.whatsapp)}</span>
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a
                    className="landing-footer__link"
                    href={`mailto:${contact.email}`}
                    aria-label={`Correo ${contact.email}`}
                  >
                    <MailIcon />
                    <span>{contact.email}</span>
                  </a>
                </li>
              )}
            </ul>
          ) : (
            <p className="landing__footer-item">Escríbenos en cualquiera de nuestras sedes.</p>
          )}
        </div>
        {hasSocial && (
          <div>
            <p className="landing__eyebrow">Redes sociales</p>
            <ul className="landing-footer__list">
              {contact.instagramUrl && (
                <li>
                  <a
                    className="landing-footer__link"
                    href={contact.instagramUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <InstagramIcon />
                    <span>Instagram</span>
                  </a>
                </li>
              )}
              {contact.facebookUrl && (
                <li>
                  <a
                    className="landing-footer__link"
                    href={contact.facebookUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <FacebookIcon />
                    <span>Facebook</span>
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      <div className="landing__footer-bottom">
        <p>Intelligent Nutrition {new Date().getFullYear()}</p>
        <div className="landing__footer-links">
          <Link to="/terminos">Términos</Link>
          <Link to="/privacidad">Privacidad</Link>
        </div>
      </div>
    </footer>
  )
}

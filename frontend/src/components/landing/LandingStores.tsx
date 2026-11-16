import { useEffect, useRef, useState } from 'react'

import type { Branch } from '../../types/branch'
import { hasSchedule, scheduleStatus, summarizeSchedule } from '../../utils/branchSchedule'

import './LandingStores.css'

const MINUTE_MS = 60 * 1000

function cityOf(address: string): string {
  const parts = address.split(',')
  return parts.length > 1 ? parts[parts.length - 1].trim() : ''
}

function mapsUrl(branch: Branch): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${branch.address} ${branch.name}`,
  )}`
}

function StoreCard({ branch, now }: { branch: Branch; now: Date }) {
  const status = scheduleStatus(branch, now)
  const city = cityOf(branch.address)
  const tone = !branch.active ? 'inactive' : status.open ? 'open' : 'closed'
  return (
    <li className={`landing-store landing-store--${tone}`}>
      <p className="landing-store__city">{city || 'Sede'}</p>
      <h3 className="landing-store__name">{branch.name}</h3>
      <p className="landing-store__status">
        <span className="landing-store__dot" aria-hidden="true" />
        {status.label}
      </p>
      <p className="landing-store__address">{branch.address}</p>
      {branch.active && hasSchedule(branch.schedule) && (
        <dl className="landing-store__hours">
          {summarizeSchedule(branch.schedule).map((row) => (
            <div key={row.days} className="landing-store__hours-row">
              <dt>{row.days}</dt>
              <dd>{row.hours}</dd>
            </div>
          ))}
        </dl>
      )}
      {branch.active && (
        <div className="landing-store__links">
          <a href={mapsUrl(branch)} target="_blank" rel="noreferrer noopener">
            Cómo llegar
            <span className="sr-only"> a {branch.name} (abre Google Maps)</span>
          </a>
          <a href={`tel:${branch.phone}`}>
            Llamar
            <span className="sr-only"> a {branch.name}</span>
          </a>
        </div>
      )}
    </li>
  )
}

interface LandingStoresProps {
  status: 'loading' | 'success' | 'error'
  branches: Branch[]
  reload: () => void
}

export function LandingStores({ status, branches, reload }: LandingStoresProps) {
  const [now, setNow] = useState(() => new Date())
  const trackRef = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), MINUTE_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const update = () =>
      setEdges({
        start: track.scrollLeft <= 4,
        end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4,
      })
    update()
    track.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      track.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [branches.length, status])

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current
    const card = track?.querySelector('li')
    if (!track || !card) return
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0
    track.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: 'smooth' })
  }

  const openCount = branches.filter((branch) => scheduleStatus(branch, now).open).length
  const activeCount = branches.filter((branch) => branch.active).length
  const scrollable = !(edges.start && edges.end)

  return (
    <section className="landing__section landing-stores" id="sedes" aria-labelledby="sedes-title">
      <div className="landing-stores__head">
        <div>
          <p className="landing__eyebrow">Sedes</p>
          <h2 className="landing__section-title" id="sedes-title">
            Dónde estamos
          </h2>
          {status === 'success' && activeCount > 0 && (
            <p className="landing-stores__summary">
              {activeCount === 1 ? '1 sede activa' : `${activeCount} sedes activas`}
              {' · '}
              {openCount === 1 ? '1 abierta ahora' : `${openCount} abiertas ahora`}
            </p>
          )}
        </div>
        {scrollable && (
          <div className="landing-stores__controls">
            <button
              type="button"
              className="landing-stores__arrow"
              aria-label="Ver sedes anteriores"
              aria-controls="landing-stores-track"
              disabled={edges.start}
              onClick={() => scrollByCard(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              className="landing-stores__arrow"
              aria-label="Ver más sedes"
              aria-controls="landing-stores-track"
              disabled={edges.end}
              onClick={() => scrollByCard(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {status === 'loading' && (
        <ul className="landing-stores__track" aria-label="Cargando sedes" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <li key={index} className="landing-store landing-store--skeleton" aria-hidden="true">
              <span className="landing-store__bone landing-store__bone--short" />
              <span className="landing-store__bone landing-store__bone--title" />
              <span className="landing-store__bone" />
              <span className="landing-store__bone" />
            </li>
          ))}
        </ul>
      )}

      {status === 'error' && (
        <div className="landing-stores__message">
          <p>No pudimos cargar las sedes en este momento.</p>
          <button type="button" className="landing-stores__retry" onClick={reload}>
            Reintentar
          </button>
        </div>
      )}

      {status === 'success' && branches.length === 0 && (
        <div className="landing-stores__message">
          <p>Muy pronto anunciaremos nuestras sedes.</p>
        </div>
      )}

      {status === 'success' && branches.length > 0 && (
        <ul
          id="landing-stores-track"
          ref={trackRef}
          className="landing-stores__track"
          aria-label="Sedes de Intelligent Nutrition"
        >
          {branches.map((branch) => (
            <StoreCard key={branch.id} branch={branch} now={now} />
          ))}
        </ul>
      )}
    </section>
  )
}

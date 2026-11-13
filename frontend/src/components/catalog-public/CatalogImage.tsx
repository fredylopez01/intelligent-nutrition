import { useState } from 'react'

import { MediaPlaceholder } from '../ui/MediaPlaceholder'

interface CatalogImageProps {
  src: string | null | undefined
  alt: string
  placeholder: string
  lazy?: boolean
}

export function CatalogImage({ src, alt, placeholder, lazy = false }: CatalogImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || failedSrc === src) return <MediaPlaceholder label={placeholder} />
  return (
    <img
      src={src}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      onError={() => setFailedSrc(src)}
    />
  )
}

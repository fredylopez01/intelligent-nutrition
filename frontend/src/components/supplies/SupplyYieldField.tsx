import type { UseFormRegisterReturn } from 'react-hook-form'

import { yieldWarning } from '../../utils/supplies'
import { TextField } from '../ui/TextField'

interface SupplyYieldFieldProps {
  id: string
  unit?: string
  productName?: string
  value: string
  error?: string
  disabled?: boolean
  registration?: UseFormRegisterReturn
  onValueChange?: (value: string) => void
}

export function SupplyYieldField({
  id,
  unit,
  productName,
  value,
  error,
  disabled,
  registration,
  onValueChange,
}: SupplyYieldFieldProps) {
  const warning = productName && !error ? yieldWarning(productName, unit, value) : null
  return (
    <div className="supply-yield">
      <TextField
        id={id}
        label={`Cuánto rinde una unidad del producto${unit ? ` (${unit})` : ''}`}
        inputMode="decimal"
        autoComplete="off"
        placeholder="Ej. 300"
        hint={
          warning
            ? undefined
            : 'Es lo que trae un tarro o paquete, en la unidad del insumo. Ej. un tarro de 300 g rinde 300 g.'
        }
        disabled={disabled}
        error={error}
        {...(registration ?? {
          value,
          onChange: (event) => onValueChange?.(event.target.value),
        })}
      />
      {warning && (
        <p className="supply-yield__warning" role="status">
          {warning}
        </p>
      )}
    </div>
  )
}

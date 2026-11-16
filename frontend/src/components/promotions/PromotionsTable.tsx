import type { Promotion } from '../../types/promotion'
import { formatPercentage, isOutsidePeriod, promotionPeriod } from '../../utils/promotions'
import { RowActions } from '../ui/RowActions'

import '../users/StatusBadge.css'
import '../categories/CategoriesTable.css'
import './Promotions.css'

interface PromotionsTableProps {
  promotions: Promotion[]
  onEdit: (promotion: Promotion) => void
  onToggleStatus: (promotion: Promotion) => void
}

export function PromotionsTable({ promotions, onEdit, onToggleStatus }: PromotionsTableProps) {
  return (
    <table className="categories-table promotions-table">
      <caption className="sr-only">Promociones registradas</caption>
      <thead>
        <tr>
          <th scope="col">Promoción</th>
          <th scope="col" className="promotions-table__col-discount">
            Descuento
          </th>
          <th scope="col" className="promotions-table__col-period">
            Vigencia
          </th>
          <th scope="col" className="categories-table__col-status">
            Estado
          </th>
          <th scope="col" className="categories-table__col-actions">
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {promotions.map((promotion) => {
          const outside = promotion.active && isOutsidePeriod(promotion)
          return (
            <tr
              key={promotion.id}
              className={promotion.active ? 'promotions-table__row--active' : undefined}
            >
              <td className="categories-table__name">
                {promotion.name}
                <span className="promotions-table__inline">
                  {formatPercentage(promotion.discountPercentage)} · {promotionPeriod(promotion)}
                </span>
              </td>
              <td className="promotions-table__col-discount">
                <span className="promotions-table__discount">
                  {formatPercentage(promotion.discountPercentage)}
                </span>
              </td>
              <td className="promotions-table__col-period promotions-table__period">
                {promotionPeriod(promotion)}
                {outside && <span className="promotions-table__warning">Fuera de su vigencia</span>}
              </td>
              <td className="categories-table__col-status">
                <span
                  className={`ui-status ui-status--${promotion.active ? 'activo' : 'inactivo'}`}
                >
                  {promotion.active ? 'Activa' : 'Inactiva'}
                </span>
              </td>
              <td className="categories-table__col-actions">
                <RowActions
                  label={`Acciones para ${promotion.name}`}
                  actions={[
                    ...(promotion.active
                      ? []
                      : [{ label: 'Editar', onSelect: () => onEdit(promotion) }]),
                    {
                      label: promotion.active ? 'Desactivar' : 'Activar',
                      tone: promotion.active ? 'danger' : undefined,
                      onSelect: () => onToggleStatus(promotion),
                    },
                  ]}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

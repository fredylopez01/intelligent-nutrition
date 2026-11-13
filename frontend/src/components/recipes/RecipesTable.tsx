import type { RecipeSummary } from '../../types/recipe'
import { ingredientsLabel } from '../../utils/recipes'
import { RowActions, type RowAction } from '../ui/RowActions'

import '../users/StatusBadge.css'
import '../categories/CategoriesTable.css'
import './Recipes.css'

interface RecipesTableProps {
  recipes: RecipeSummary[]
  canEdit: boolean
  canChangeStatus: boolean
  onView: (recipe: RecipeSummary) => void
  onEdit: (recipe: RecipeSummary) => void
  onToggleStatus: (recipe: RecipeSummary) => void
}

export function RecipesTable({
  recipes,
  canEdit,
  canChangeStatus,
  onView,
  onEdit,
  onToggleStatus,
}: RecipesTableProps) {
  return (
    <table className="categories-table recipes-table">
      <caption className="sr-only">Recetas registradas</caption>
      <thead>
        <tr>
          <th scope="col">Receta</th>
          <th scope="col" className="recipes-table__col-ingredients">
            Ingredientes
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
        {recipes.map((recipe) => {
          const actions: RowAction[] = [{ label: 'Ver receta', onSelect: () => onView(recipe) }]
          if (canEdit) actions.push({ label: 'Editar', onSelect: () => onEdit(recipe) })
          if (canChangeStatus) {
            actions.push({
              label: recipe.active ? 'Desactivar' : 'Activar',
              tone: recipe.active ? 'danger' : undefined,
              onSelect: () => onToggleStatus(recipe),
            })
          }
          return (
            <tr key={recipe.id}>
              <td className="categories-table__name">
                <button
                  type="button"
                  className="recipes-table__open"
                  onClick={() => onView(recipe)}
                >
                  {recipe.name}
                </button>
                {recipe.description && (
                  <span className="recipes-table__description">{recipe.description}</span>
                )}
                <span className="recipes-table__inline">
                  {ingredientsLabel(recipe.ingredientsCount)}
                </span>
              </td>
              <td className="recipes-table__col-ingredients">
                {ingredientsLabel(recipe.ingredientsCount)}
              </td>
              <td className="categories-table__col-status">
                <span className={`ui-status ui-status--${recipe.active ? 'activo' : 'inactivo'}`}>
                  {recipe.active ? 'Activa' : 'Inactiva'}
                </span>
              </td>
              <td className="categories-table__col-actions">
                <RowActions label={`Acciones para ${recipe.name}`} actions={actions} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

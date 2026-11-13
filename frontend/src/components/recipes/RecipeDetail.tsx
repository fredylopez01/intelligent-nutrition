import type { Recipe } from '../../types/recipe'
import { formatIngredientQuantity, ingredientsLabel } from '../../utils/recipes'

import './Recipes.css'

interface RecipeDetailProps {
  recipe: Recipe
}

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  return (
    <div className="recipe-detail">
      <div className="recipe-detail__meta">
        <span className={`ui-status ui-status--${recipe.active ? 'activo' : 'inactivo'}`}>
          {recipe.active ? 'Activa' : 'Inactiva'}
        </span>
        <span>{ingredientsLabel(recipe.ingredients.length)}</span>
      </div>
      {recipe.description && <p className="recipe-detail__description">{recipe.description}</p>}
      <table className="recipe-detail__table">
        <caption className="sr-only">Ingredientes de {recipe.name}</caption>
        <thead>
          <tr>
            <th scope="col">Insumo</th>
            <th scope="col" className="recipe-detail__quantity">
              Cantidad
            </th>
          </tr>
        </thead>
        <tbody>
          {recipe.ingredients.map((ingredient) => (
            <tr key={ingredient.id}>
              <td>{ingredient.supply.name}</td>
              <td className="recipe-detail__quantity">
                {formatIngredientQuantity(
                  ingredient.quantity,
                  ingredient.unitOfMeasure.abbreviation,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { flushSync } from 'react-dom'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'

import { useAuth } from '../../hooks/useAuth'
import { useRecipeFormOptions } from '../../hooks/useRecipeFormOptions'
import { recipesService } from '../../services/recipes.service'
import type { Recipe, UpdateRecipePayload } from '../../types/recipe'
import type { Supply, SupplySourceProduct } from '../../types/supply'
import {
  RECIPE_DESCRIPTION_MAX_LENGTH,
  buildRecipeChanges,
  recipeFormValues,
  recipeSchema,
  resolveRecipeError,
  toIngredientPayloads,
  type RecipeFormValues,
} from '../../utils/recipes'
import { SupplyProductPicker } from '../supplies/SupplyProductPicker'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { TextAreaField } from '../ui/TextAreaField'
import { TextField } from '../ui/TextField'

import { RecipeCatalogIngredient } from './RecipeCatalogIngredient'

import '../categories/CategoryForm.css'
import './Recipes.css'

interface RecipeFormProps {
  recipe?: Recipe
  onSaved: (recipe: Recipe) => void
  onCancel: () => void
}

const EMPTY_INGREDIENT = { supplyId: '', quantity: '', unitOfMeasureId: '' }

export function RecipeForm({ recipe, onSaved, onCancel }: RecipeFormProps) {
  const { token } = useAuth()
  const options = useRecipeFormOptions()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const initialProduct = recipe?.product ?? null
  const [sold, setSold] = useState(initialProduct !== null)
  const [product, setProduct] = useState<SupplySourceProduct | null>(
    initialProduct
      ? {
          id: initialProduct.id,
          name: initialProduct.name,
          referenceCode: initialProduct.referenceCode,
        }
      : null,
  )
  const [productError, setProductError] = useState<string | null>(null)
  const [extraSupplies, setExtraSupplies] = useState<Supply[]>([])
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: recipe
      ? recipeFormValues(recipe)
      : { ...recipeFormValues(), ingredients: [EMPTY_INGREDIENT] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'ingredients' })
  const description = useWatch({ control, name: 'description' })

  const knownSupplies = new Map(
    [...options.supplies, ...extraSupplies].map((supply) => [supply.id, supply]),
  )
  for (const ingredient of recipe?.ingredients ?? []) {
    if (!knownSupplies.has(ingredient.supply.id)) {
      knownSupplies.set(ingredient.supply.id, {
        id: ingredient.supply.id,
        name: `${ingredient.supply.name} (inactivo)`,
        unitOfMeasure: ingredient.supply.unitOfMeasure,
        active: false,
        createdAt: '',
      })
    }
  }
  const knownUnits = new Map(options.units.map((unit) => [unit.id, unit.abbreviation]))
  for (const ingredient of recipe?.ingredients ?? []) {
    if (!knownUnits.has(ingredient.unitOfMeasure.id)) {
      knownUnits.set(ingredient.unitOfMeasure.id, ingredient.unitOfMeasure.abbreviation)
    }
  }

  const handleSupplyChange = (index: number, supplyId: string) => {
    const previous = knownSupplies.get(getValues(`ingredients.${index}.supplyId`))
    const next = knownSupplies.get(supplyId)
    const currentUnit = getValues(`ingredients.${index}.unitOfMeasureId`)
    if (next && (!currentUnit || currentUnit === previous?.unitOfMeasure.id)) {
      setValue(`ingredients.${index}.unitOfMeasureId`, next.unitOfMeasure.id)
    }
  }

  const addCatalogSupply = (supply: Supply) => {
    setCatalogOpen(false)
    const lines = getValues('ingredients')
    if (lines.some((line) => line.supplyId === supply.id)) {
      setCatalogNotice(`${supply.name} ya está en la receta.`)
      return
    }
    if (!knownSupplies.has(supply.id)) {
      flushSync(() => setExtraSupplies((current) => [...current, supply]))
    }
    setCatalogNotice(`${supply.name} quedó como ingrediente. Escribe la cantidad que se gasta.`)
    const emptyIndex = lines.findIndex((line) => !line.supplyId)
    if (emptyIndex === -1) {
      append({ supplyId: supply.id, quantity: '', unitOfMeasureId: supply.unitOfMeasure.id })
      return
    }
    setValue(`ingredients.${emptyIndex}.supplyId`, supply.id, { shouldValidate: true })
    if (!lines[emptyIndex].unitOfMeasureId) {
      setValue(`ingredients.${emptyIndex}.unitOfMeasureId`, supply.unitOfMeasure.id, {
        shouldValidate: true,
      })
    }
  }

  const onSubmit = async (values: RecipeFormValues) => {
    if (sold && !product) {
      setProductError('Elige el producto del catálogo que se vende con esta receta.')
      return
    }
    setSubmitError(null)
    const productId = sold && product ? product.id : null
    try {
      if (recipe) {
        const changes: UpdateRecipePayload = buildRecipeChanges(values, recipe)
        if (productId !== (initialProduct?.id ?? null)) changes.productId = productId
        if (Object.keys(changes).length === 0) {
          setSubmitError('No hay cambios por guardar.')
          return
        }
        onSaved(await recipesService.update(recipe.id, changes, token))
        return
      }
      const created = await recipesService.create(
        {
          name: values.name.trim(),
          ...(values.description.trim() ? { description: values.description.trim() } : {}),
          ingredients: toIngredientPayloads(values.ingredients),
          ...(productId ? { productId } : {}),
        },
        token,
      )
      onSaved(created)
    } catch (error) {
      setSubmitError(
        resolveRecipeError(
          error,
          recipe
            ? 'No fue posible guardar la receta. Intenta de nuevo.'
            : 'No fue posible registrar la receta. Intenta de nuevo.',
        ),
      )
    }
  }

  const ingredientsError = errors.ingredients?.root?.message ?? errors.ingredients?.message
  const noSupplies = options.status === 'success' && options.supplies.length === 0

  return (
    <form
      className="category-form recipe-form"
      onSubmit={handleSubmit(onSubmit, () => {
        if (sold && !product) {
          setProductError('Elige el producto del catálogo que se vende con esta receta.')
        }
      })}
      noValidate
    >
      {submitError && <Alert tone="error">{submitError}</Alert>}

      <TextField
        id="recipe-name"
        label="Nombre"
        placeholder="Ej. Batido de proteína con avena"
        autoComplete="off"
        error={errors.name?.message}
        {...register('name')}
      />
      <TextAreaField
        id="recipe-description"
        label="Descripción (opcional)"
        rows={2}
        maxLength={RECIPE_DESCRIPTION_MAX_LENGTH}
        length={description.length}
        placeholder="Ej. Se prepara con leche fría y se sirve en vaso de 16 oz"
        error={errors.description?.message}
        {...register('description')}
      />

      <div className="recipe-form__product">
        <label className="recipe-form__product-toggle" htmlFor="recipe-sold">
          <input
            id="recipe-sold"
            type="checkbox"
            checked={sold}
            disabled={isSubmitting}
            onChange={(event) => {
              setSold(event.target.checked)
              setProductError(null)
            }}
          />
          <strong>Se vende en el POS como un producto del catálogo</strong>
          <small>
            Al venderlo se descuentan estos insumos de la sede en lugar de unidades del inventario.
            El precio es el del producto.
          </small>
        </label>
        {sold && (
          <SupplyProductPicker
            id="recipe-product-search"
            selected={product}
            onSelect={(next) => {
              setProduct(next)
              setProductError(null)
            }}
            disabled={isSubmitting}
            error={productError ?? undefined}
          />
        )}
      </div>

      <fieldset className="recipe-form__ingredients">
        <legend className="recipe-form__legend">Ingredientes</legend>
        <p className="recipe-form__hint">
          Cada ingrediente es un insumo con la cantidad que se gasta al preparar una unidad. Si usas
          parte de un producto que se vende, como un tarro de proteína, elígelo del catálogo.
        </p>

        {options.status === 'error' && (
          <div className="recipe-form__options-error">
            <Alert tone="error">No fue posible cargar los insumos y las unidades.</Alert>
            <Button variant="outline" onClick={options.reload}>
              Reintentar
            </Button>
          </div>
        )}
        {noSupplies && (
          <Alert tone="info">
            No hay insumos activos. Registra los insumos en Inventario › Insumos antes de crear la
            receta.
          </Alert>
        )}

        <ul className="recipe-form__lines" aria-label="Ingredientes de la receta">
          {fields.map((field, index) => {
            const lineErrors = errors.ingredients?.[index]
            const supplyField = register(`ingredients.${index}.supplyId`)
            return (
              <li key={field.id} className="recipe-form__line">
                <div className="recipe-form__field recipe-form__field--supply">
                  <label htmlFor={`recipe-supply-${index}`}>Insumo</label>
                  <select
                    id={`recipe-supply-${index}`}
                    className={`ui-field__control ui-field__control--select${lineErrors?.supplyId ? ' ui-field__control--invalid' : ''}`}
                    disabled={options.status !== 'success' || isSubmitting}
                    {...supplyField}
                    onChange={(event) => {
                      handleSupplyChange(index, event.target.value)
                      void supplyField.onChange(event)
                    }}
                  >
                    <option value="">
                      {options.status === 'loading' ? 'Cargando insumos...' : 'Elige el insumo'}
                    </option>
                    {[...knownSupplies.values()].map((supply) => (
                      <option key={supply.id} value={supply.id}>
                        {supply.name}
                      </option>
                    ))}
                  </select>
                  {lineErrors?.supplyId && (
                    <span className="ui-field__error" role="alert">
                      {lineErrors.supplyId.message}
                    </span>
                  )}
                </div>
                <div className="recipe-form__field">
                  <label htmlFor={`recipe-quantity-${index}`}>Cantidad</label>
                  <input
                    id={`recipe-quantity-${index}`}
                    className={`ui-field__control recipe-form__quantity${lineErrors?.quantity ? ' ui-field__control--invalid' : ''}`}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="Ej. 30"
                    disabled={isSubmitting}
                    {...register(`ingredients.${index}.quantity`)}
                  />
                  {lineErrors?.quantity && (
                    <span className="ui-field__error" role="alert">
                      {lineErrors.quantity.message}
                    </span>
                  )}
                </div>
                <div className="recipe-form__field">
                  <label htmlFor={`recipe-unit-${index}`}>Unidad</label>
                  <select
                    id={`recipe-unit-${index}`}
                    className={`ui-field__control ui-field__control--select${lineErrors?.unitOfMeasureId ? ' ui-field__control--invalid' : ''}`}
                    disabled={options.status !== 'success' || isSubmitting}
                    {...register(`ingredients.${index}.unitOfMeasureId`)}
                  >
                    <option value="">Unidad</option>
                    {[...knownUnits.entries()].map(([id, abbreviation]) => (
                      <option key={id} value={id}>
                        {abbreviation}
                      </option>
                    ))}
                  </select>
                  {lineErrors?.unitOfMeasureId && (
                    <span className="ui-field__error" role="alert">
                      {lineErrors.unitOfMeasureId.message}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="recipe-form__remove"
                  aria-label={`Quitar el ingrediente ${index + 1}`}
                  onClick={() => remove(index)}
                  disabled={isSubmitting || fields.length === 1}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
        {ingredientsError && (
          <span className="ui-field__error" role="alert">
            {ingredientsError}
          </span>
        )}
        {catalogNotice && !catalogOpen && <Alert tone="info">{catalogNotice}</Alert>}
        {catalogOpen ? (
          <RecipeCatalogIngredient
            supplies={[...knownSupplies.values()]}
            units={options.units}
            onUse={addCatalogSupply}
            onCancel={() => setCatalogOpen(false)}
          />
        ) : (
          <div className="recipe-form__line-actions">
            <Button
              variant="outline"
              onClick={() => {
                setCatalogNotice(null)
                append(EMPTY_INGREDIENT)
              }}
              disabled={isSubmitting || options.status !== 'success'}
            >
              Agregar ingrediente
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCatalogNotice(null)
                setCatalogOpen(true)
              }}
              disabled={isSubmitting || options.status !== 'success'}
            >
              Usar un producto del catálogo
            </Button>
          </div>
        )}
      </fieldset>

      <div className="category-form__actions">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : recipe ? 'Guardar cambios' : 'Registrar receta'}
        </Button>
      </div>
    </form>
  )
}

import type { Prisma } from "../../../generated/prisma/client.js";

type Client = Prisma.TransactionClient;

const UNIT_FACTORS: Record<string, Record<string, number>> = {
  kg: { g: 1000 },
  g: { kg: 0.001 },
  l: { ml: 1000 },
  ml: { l: 0.001 },
};

export function unitFactor(from: string, to: string): number | null {
  const source = from.trim().toLowerCase();
  const target = to.trim().toLowerCase();
  if (source === target) return 1;
  return UNIT_FACTORS[source]?.[target] ?? null;
}

export interface PreparedIngredient {
  supplyId: string;
  supplyName: string;
  unit: string;
  perUnit: number;
}

export interface PreparedRecipe {
  id: string;
  name: string;
  active: boolean;
  productId: string | null;
  ingredients: PreparedIngredient[];
  unitMismatch: { supplyId: string; supplyName: string } | null;
}

const recipeSelect = {
  id: true,
  name: true,
  active: true,
  productId: true,
  ingredients: {
    select: {
      quantity: true,
      unitOfMeasure: { select: { abreviation: true } },
      supply: {
        select: {
          id: true,
          name: true,
          unitOfMeasure: { select: { abreviation: true } },
        },
      },
    },
  },
} satisfies Prisma.RecipeSelect;

type RecipeRow = Prisma.RecipeGetPayload<{ select: typeof recipeSelect }>;

function toPrepared(recipe: RecipeRow): PreparedRecipe {
  let unitMismatch: PreparedRecipe["unitMismatch"] = null;
  const ingredients = recipe.ingredients.map((ingredient) => {
    const unit = ingredient.supply.unitOfMeasure.abreviation;
    const factor = unitFactor(ingredient.unitOfMeasure.abreviation, unit);
    if (factor === null && !unitMismatch) {
      unitMismatch = {
        supplyId: ingredient.supply.id,
        supplyName: ingredient.supply.name,
      };
    }
    return {
      supplyId: ingredient.supply.id,
      supplyName: ingredient.supply.name,
      unit,
      perUnit: Number(ingredient.quantity) * (factor ?? 1),
    };
  });
  return {
    id: recipe.id,
    name: recipe.name,
    active: recipe.active,
    productId: recipe.productId,
    ingredients,
    unitMismatch,
  };
}

export async function loadRecipes(
  client: Client,
  where: Prisma.RecipeWhereInput,
): Promise<PreparedRecipe[]> {
  const recipes = await client.recipe.findMany({ where, select: recipeSelect });
  return recipes.map(toPrepared);
}

export async function supplyStockMap(
  client: Client,
  branchId: string,
  supplyIds: string[],
): Promise<Map<string, number>> {
  if (supplyIds.length === 0) return new Map();
  const rows = await client.supplyStock.findMany({
    where: { branchId, supplyId: { in: supplyIds } },
    select: { supplyId: true, quantity: true },
  });
  return new Map(rows.map((row) => [row.supplyId, Number(row.quantity)]));
}

export function preparedAvailability(
  recipe: PreparedRecipe,
  stock: Map<string, number>,
): number {
  if (!recipe.active || recipe.unitMismatch) return 0;
  if (recipe.ingredients.length === 0) return 0;
  return Math.max(
    0,
    Math.min(
      ...recipe.ingredients.map((ingredient) =>
        ingredient.perUnit > 0
          ? Math.floor(
              ((stock.get(ingredient.supplyId) ?? 0) + 1e-9) /
                ingredient.perUnit,
            )
          : Number.MAX_SAFE_INTEGER,
      ),
    ),
  );
}

export function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

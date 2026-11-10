import { Type } from "class-transformer";
import { IsNumber, IsUUID, Min } from "class-validator";

export class RecipeIngredientDto {
  @IsUUID()
  supplyId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsUUID()
  unitOfMeasureId!: string;
}

export function hasDuplicateSupplies(
  ingredients: RecipeIngredientDto[] | undefined,
): boolean {
  if (!ingredients) {
    return false;
  }
  return (
    new Set(ingredients.map(({ supplyId }) => supplyId)).size !==
    ingredients.length
  );
}

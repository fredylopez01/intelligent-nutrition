import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsUUID, Min } from "class-validator";

export class RecipeIngredientDto {
  @ApiProperty({ format: "uuid", description: "Active supply." })
  @IsUUID()
  supplyId!: string;

  @ApiProperty({
    minimum: 0.001,
    example: 30,
    description: "Quantity used per unit prepared, up to 3 decimals.",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiProperty({
    format: "uuid",
    description: "Active unit of measure of the quantity.",
  })
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

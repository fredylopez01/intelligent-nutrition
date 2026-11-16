import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsUUID,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { RecipeIngredientDto } from "./recipe-ingredient.dto.js";

export class UpdateRecipeDto {
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 150,
    description: "Unique recipe name.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: "Description; null clears it.",
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    type: () => [RecipeIngredientDto],
    description: "New list of ingredients. It replaces the whole list.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients?: RecipeIngredientDto[];

  @ApiPropertyOptional({
    format: "uuid",
    nullable: true,
    description:
      "Catalog product sold as this prepared recipe. Selling it deducts the recipe supplies instead of the product lots. null removes the link.",
  })
  @IsOptional()
  @IsUUID("all")
  productId?: string | null;
}

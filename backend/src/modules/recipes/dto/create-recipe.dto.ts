import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { RecipeIngredientDto } from "./recipe-ingredient.dto.js";

export class CreateRecipeDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 150,
    example: "Batido de proteína con avena",
    description: "Unique recipe name, case insensitive.",
  })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: "Se prepara con leche fría.",
    description: "Optional description.",
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({
    type: () => [RecipeIngredientDto],
    minItems: 1,
    description: "Supplies of the recipe. Each supply can appear only once.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];
}

import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    minLength: 3,
    maxLength: 100,
    description:
      "Category name. It must be unique. At least one field must be sent.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ maxLength: 255, description: "Category description." })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description?: string;
}

import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

export class UpdateProductDto {
  @ApiPropertyOptional({
    maxLength: 150,
    description: "Product name. At least one editable field must be sent.",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: "Product description." })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Active category of the product.",
  })
  @IsOptional()
  @IsUUID("4")
  categoryId?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Active unit of measure of the product.",
  })
  @IsOptional()
  @IsUUID("4")
  unitOfMeasureId?: string;

  @ApiPropertyOptional({
    pattern: "^\\d+(\\.\\d{1,2})?$",
    example: "98000.00",
    description: "Sale price as a decimal string with up to 2 decimals.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "price must be a number with up to 2 decimals",
  })
  price?: string;

  @ApiPropertyOptional({
    description:
      "Not editable: sending it is rejected with 400 FIELD_NOT_EDITABLE.",
  })
  @IsOptional()
  @IsString()
  referenceCode?: string;
}

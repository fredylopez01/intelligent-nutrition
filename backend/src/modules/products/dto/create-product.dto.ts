import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateProductDto {
  @ApiProperty({
    maxLength: 150,
    example: "Vitamina C 1000 mg 30 cápsulas",
    description: "Product name.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    minLength: 2,
    maxLength: 50,
    pattern: "^[A-Za-z0-9_-]+$",
    example: "VIT-C-1000-30C",
    description:
      "Unique reference code. Only letters, digits, hyphens and underscores. It cannot be changed once the product is created.",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, {
    message: "referenceCode must be between 2 and 50 characters",
  })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message:
      "referenceCode can only contain alphanumeric characters, hyphens and underscores",
  })
  referenceCode!: string;

  @ApiPropertyOptional({ description: "Product description." })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    format: "uuid",
    description: "Active category of the product.",
  })
  @IsUUID("4")
  categoryId!: string;

  @ApiProperty({
    format: "uuid",
    description: "Active unit of measure of the product.",
  })
  @IsUUID("4")
  unitOfMeasureId!: string;

  @ApiProperty({
    pattern: "^\\d+(\\.\\d{1,2})?$",
    example: "98000.00",
    description: "Sale price as a decimal string with up to 2 decimals.",
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "price must be a number with up to 2 decimals",
  })
  price!: string;
}

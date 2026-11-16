import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { IsDecimalString } from "./is-decimal-string.validator.js";

export class CreatePurchaseItemDto {
  @ApiProperty({ format: "uuid", description: "Product being purchased." })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    minimum: 1,
    example: 30,
    description: "Units requested from the supplier.",
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  requestedQuantity!: number;

  @ApiProperty({
    example: "98000.00",
    pattern: "^\\d+\\.\\d{2}$",
    description: "Cost per unit, as a decimal string with 2 decimals.",
  })
  @IsDecimalString({
    message: 'unitPrice must be a decimal string (e.g. "98000.00")',
  })
  @IsNotEmpty()
  @Matches(/^\d+\.\d{2}$/, {
    message: "unitPrice must have exactly 2 decimal places",
  })
  unitPrice!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 500,
    description: "Free-text note about this line.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string | null;
}

export class CreatePurchaseDto {
  @ApiProperty({
    format: "uuid",
    description: "Active supplier that provides the goods.",
  })
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 500,
    description: "Free-text note about the purchase order.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string | null;

  @ApiProperty({
    type: [CreatePurchaseItemDto],
    minItems: 1,
    description: "Products requested. A product can appear only once.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}

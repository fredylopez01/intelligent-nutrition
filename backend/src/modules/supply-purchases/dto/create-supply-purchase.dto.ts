import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { IsDecimalString } from "../../purchases/dto/is-decimal-string.validator.js";

export class CreateSupplyPurchaseItemDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  supplyId!: string;

  @ApiProperty({
    example: 5000,
    description:
      "Quantity in the unit of the supply (for example grams), up to 3 decimals.",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999999999)
  quantity!: number;

  @ApiProperty({
    example: "18.50",
    description: "Cost of one unit of the supply, with 2 decimals.",
  })
  @IsDecimalString({
    message: 'unitCost must be a decimal string like "18.50"',
  })
  unitCost!: string;
}

export class CreateSupplyPurchaseDto {
  @ApiProperty({ format: "uuid", description: "Active supplier." })
  @IsUUID("4")
  supplierId!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string;

  @ApiProperty({
    type: [CreateSupplyPurchaseItemDto],
    minItems: 1,
    maxItems: 50,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateSupplyPurchaseItemDto)
  items!: CreateSupplyPurchaseItemDto[];
}

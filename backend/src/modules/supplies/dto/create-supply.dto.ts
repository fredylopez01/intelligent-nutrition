import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateSupplyDto {
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 150,
    example: "Leche entera",
    description:
      "Unique supply name, case insensitive. Required without sourceProductId; with a product the supply takes the product name and this field is ignored.",
  })
  @ValidateIf((dto: CreateSupplyDto) => !dto.sourceProductId)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiProperty({
    format: "uuid",
    description: "Active unit of measure used for the stock.",
  })
  @IsUUID()
  @IsNotEmpty()
  unitOfMeasureId!: string;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Catalog product this supply comes from when it is portioned, for example a 2 lb whey for protein shakes.",
  })
  @IsOptional()
  @IsUUID("4")
  sourceProductId?: string;

  @ApiPropertyOptional({
    example: 907,
    description:
      "Quantity of the supply obtained from one unit of the product (in the unit of the supply). Required with sourceProductId.",
  })
  @ValidateIf((dto: CreateSupplyDto) => Boolean(dto.sourceProductId))
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  productUnitQuantity?: number;
}

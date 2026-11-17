import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsNumber,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdateSupplyDto {
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 150,
    description:
      "Unique supply name. Not editable while the supply comes from a product: it follows the product name.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Active unit of measure.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  unitOfMeasureId?: string;

  @ApiPropertyOptional({
    format: "uuid",
    nullable: true,
    description:
      "Catalog product this supply comes from. Each product feeds a single supply, and the supply takes its name. Send null to remove the link.",
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID("4")
  sourceProductId?: string | null;

  @ApiPropertyOptional({
    example: 907,
    description:
      "Quantity of the supply per unit of the product. Required when sourceProductId is sent.",
  })
  @ValidateIf(
    (dto: UpdateSupplyDto, value) =>
      value !== undefined || typeof dto.sourceProductId === "string",
  )
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  productUnitQuantity?: number;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class ReceiveSupplyPurchaseItemDto {
  @ApiProperty({ format: "uuid", description: "Line of the purchase." })
  @IsUUID("4")
  detailId!: string;

  @ApiProperty({ example: 2500, description: "Quantity received now." })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;
}

export class ReceiveSupplyPurchaseDto {
  @ApiProperty({
    format: "uuid",
    description: "Branch that receives the supplies.",
  })
  @IsUUID("4")
  branchId!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string;

  @ApiProperty({ type: [ReceiveSupplyPurchaseItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveSupplyPurchaseItemDto)
  items!: ReceiveSupplyPurchaseItemDto[];
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from "class-validator";
import { SupplyMovementType } from "../../../../generated/prisma/enums.js";

export class CreateSupplyStockMovementDto {
  @ApiProperty({ format: "uuid", description: "Branch of the movement." })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ format: "uuid", description: "Active supply." })
  @IsUUID()
  supplyId!: string;

  @ApiProperty({
    enum: ["ENTRY", "EXIT"],
    description: "ENTRY adds to the stock and EXIT removes from it.",
  })
  @IsEnum(SupplyMovementType)
  movementType!: SupplyMovementType;

  @ApiProperty({
    minimum: 1,
    example: 500,
    description: "Whole units in the unit of measure of the supply.",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    example: "Preparación de batidos",
    description: "Reason of the movement. Required for EXIT.",
  })
  @ValidateIf((o) => o.movementType === SupplyMovementType.EXIT)
  @IsString()
  @IsNotEmpty()
  observation?: string;
}

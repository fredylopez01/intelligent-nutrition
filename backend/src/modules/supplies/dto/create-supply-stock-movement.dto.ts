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
  @IsUUID()
  branchId!: string;

  @IsUUID()
  supplyId!: string;

  @IsEnum(SupplyMovementType)
  movementType!: SupplyMovementType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ValidateIf((o) => o.movementType === SupplyMovementType.EXIT)
  @IsString()
  @IsNotEmpty()
  observation?: string;
}

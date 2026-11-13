import { Type } from "class-transformer";
import { IsNumber, IsUUID, Max, Min } from "class-validator";

export class UpdateSupplyMinimumDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  supplyId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999999999)
  minimumQuantity!: number;
}

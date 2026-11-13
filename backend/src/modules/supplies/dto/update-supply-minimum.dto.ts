import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsUUID, Max, Min } from "class-validator";

export class UpdateSupplyMinimumDto {
  @ApiProperty({ format: "uuid", description: "Branch of the stock." })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ format: "uuid", description: "Active supply." })
  @IsUUID()
  supplyId!: string;

  @ApiProperty({
    minimum: 0,
    example: 1000,
    description: "Minimum quantity, up to 3 decimals.",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999999999)
  minimumQuantity!: number;
}

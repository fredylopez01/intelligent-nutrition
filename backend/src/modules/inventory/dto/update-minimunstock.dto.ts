import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class UpdateMinimumStockDto {
  @ApiProperty({
    minimum: 0,
    example: 10,
    description: "New minimum stock threshold for the product in this branch.",
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumStock!: number;
}

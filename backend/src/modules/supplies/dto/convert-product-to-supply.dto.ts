import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ConvertProductToSupplyDto {
  @ApiProperty({
    format: "uuid",
    description: "Branch where the product is opened.",
  })
  @IsUUID("4")
  branchId!: string;

  @ApiProperty({
    format: "uuid",
    description: "Supply linked to the product (sourceProductId).",
  })
  @IsUUID("4")
  supplyId!: string;

  @ApiProperty({
    minimum: 1,
    maximum: 100,
    example: 1,
    description: "Whole units of the product to open.",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  productUnits!: number;

  @ApiPropertyOptional({ maxLength: 300 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(300)
  observation?: string;
}

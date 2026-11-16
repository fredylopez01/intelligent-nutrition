import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ListSalesQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    description: "Page number (1-based).",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 20,
    description: "Items per page.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Filter by branch. Required for branch-scoped roles.",
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    enum: ["COMPLETED", "REVERSED"],
    description: "Filter by sale status.",
  })
  @IsOptional()
  @IsString()
  @IsIn(["COMPLETED", "REVERSED"])
  status?: string;

  @ApiPropertyOptional({
    example: "2026-11-01",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    description: "Start of the date range (inclusive), format YYYY-MM-DD.",
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "from must be a date in YYYY-MM-DD format",
  })
  from?: string;

  @ApiPropertyOptional({
    example: "2026-11-30",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    description: "End of the date range (inclusive), format YYYY-MM-DD.",
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "to must be a date in YYYY-MM-DD format",
  })
  to?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Only sales that include this product.",
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Only sales of this customer.",
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    maxLength: 30,
    description: "Case-insensitive search on the sale number.",
  })
  @IsOptional()
  @Transform(({ value }): unknown =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(30)
  search?: string;
}

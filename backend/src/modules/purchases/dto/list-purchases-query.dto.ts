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

export class ListPurchasesQueryDto {
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

  @ApiPropertyOptional({ format: "uuid", description: "Filter by supplier." })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({
    enum: ["PENDING_RECEIPT", "PARTIALLY_RECEIVED", "FULLY_RECEIVED"],
    description: "Filter by receipt status.",
  })
  @IsOptional()
  @IsString()
  @IsIn(["PENDING_RECEIPT", "PARTIALLY_RECEIVED", "FULLY_RECEIVED"])
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
    description: "Only purchases that include this product.",
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    maxLength: 150,
    description: "Search text (minimum 2 characters).",
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(150)
  search?: string;
}

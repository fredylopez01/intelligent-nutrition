import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export enum CatalogSort {
  NAME = "name",
  PRICE_ASC = "price_asc",
  PRICE_DESC = "price_desc",
}

export class ListCatalogProductsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: "Page number." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 48,
    default: 12,
    description: "Items per page.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit: number = 12;

  @ApiPropertyOptional({
    description:
      "Case- and accent-insensitive search text (minimum 2 characters).",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ format: "uuid", description: "Filter by category." })
  @IsOptional()
  @IsUUID("4")
  categoryId?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Only products with units in this active branch.",
  })
  @IsOptional()
  @IsUUID("4")
  branchId?: string;

  @ApiPropertyOptional({
    enum: CatalogSort,
    default: CatalogSort.NAME,
    description: "Sort by name or by price.",
  })
  @IsOptional()
  @IsEnum(CatalogSort)
  sort: CatalogSort = CatalogSort.NAME;
}

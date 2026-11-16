import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export enum ProductSortBy {
  NAME = "name",
  REFERENCE_CODE = "referenceCode",
  PRICE = "price",
  CREATED_AT = "createdAt",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export class ListProductsQueryDto {
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
    description: "Filter by unit of measure.",
  })
  @IsOptional()
  @IsUUID("4")
  unitOfMeasureId?: string;

  @ApiPropertyOptional({
    description: "Filter by active status. Omit to list all products.",
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    enum: ProductSortBy,
    enumName: "ProductSortBy",
    default: ProductSortBy.CREATED_AT,
    description: "Field used to sort the results.",
  })
  @IsOptional()
  @IsEnum(ProductSortBy)
  sortBy: ProductSortBy = ProductSortBy.CREATED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    enumName: "SortOrder",
    default: SortOrder.DESC,
    description: "Sort direction.",
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.DESC;
}

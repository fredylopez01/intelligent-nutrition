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

function toBoolean({ value }: { value: unknown }) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

export enum BranchInventorySortBy {
  NAME = "name",
  QUANTITY = "quantity",
  REFERENCE_CODE = "referenceCode",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export class ListBranchInventoryQueryDto {
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

  @ApiPropertyOptional({ description: "Search text (minimum 2 characters)." })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Filter by product category.",
  })
  @IsOptional()
  @IsUUID("4")
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      "Filter by low-stock status: true keeps products whose total quantity is below the minimum stock, false keeps the rest.",
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  lowStock?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: "Filter by product active status.",
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  productActive?: boolean = true;

  @ApiPropertyOptional({
    enum: BranchInventorySortBy,
    enumName: "BranchInventorySortBy",
    default: BranchInventorySortBy.NAME,
    description: "Field used to sort the results.",
  })
  @IsOptional()
  @IsEnum(BranchInventorySortBy)
  sortBy: BranchInventorySortBy = BranchInventorySortBy.NAME;

  @ApiPropertyOptional({
    enum: SortOrder,
    enumName: "SortOrder",
    default: SortOrder.ASC,
    description: "Sort direction.",
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.ASC;
}

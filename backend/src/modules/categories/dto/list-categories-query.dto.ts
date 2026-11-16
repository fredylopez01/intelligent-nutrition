import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ListCategoriesQueryDto {
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
    default: 10,
    description: "Items per page.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({
    description: "Filter by active status. Omit to list all categories.",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    maxLength: 150,
    description: "Search text (minimum 2 characters).",
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({
    enum: ["name", "createdAt"],
    default: "name",
    description: "Field used to sort the results.",
  })
  @IsOptional()
  @IsString()
  @IsIn(["name", "createdAt"])
  sortBy: "name" | "createdAt" = "name";

  @ApiPropertyOptional({
    enum: ["asc", "desc"],
    default: "asc",
    description: "Sort direction (case-insensitive).",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === "string" ? value.toLowerCase() : value,
  )
  @IsIn(["asc", "desc"])
  sortOrder: "asc" | "desc" = "asc";
}

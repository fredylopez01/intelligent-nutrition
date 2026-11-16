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

export class ListRecipesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: "Page number." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 20,
    description: "Page size.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ type: Boolean, description: "Filter by state." })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 150,
    description: "Search by name, at least 2 characters.",
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({
    enum: ["name", "createdAt"],
    default: "name",
    description: "Sort field.",
  })
  @IsOptional()
  @IsString()
  @IsIn(["name", "createdAt"])
  sortBy: "name" | "createdAt" = "name";

  @ApiPropertyOptional({
    enum: ["asc", "desc"],
    default: "asc",
    description: "Sort direction.",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.toLowerCase() : value,
  )
  @IsIn(["asc", "desc"])
  sortOrder: "asc" | "desc" = "asc";
}

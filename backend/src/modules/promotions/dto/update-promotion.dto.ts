import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdatePromotionDto {
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 100,
    example: "Black Friday Suplementos",
    description: "Unique promotion name.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    pattern: "^(?:100\\.00|(?:\\d|[1-9]\\d)\\.\\d{2})$",
    example: "20.00",
    description: "Discount percentage with two decimals.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/^(?:100\.00|(?:\d|[1-9]\d)\.\d{2})$/)
  discountPercentage?: string;

  @ApiPropertyOptional({
    format: "date",
    example: "2026-11-12",
    description: "First day of validity.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiPropertyOptional({
    format: "date",
    example: "2026-11-30",
    description: "Last day of validity.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}

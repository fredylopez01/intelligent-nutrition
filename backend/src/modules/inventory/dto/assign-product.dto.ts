import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class AssignProductDto {
  @ApiProperty({
    format: "uuid",
    description: "Active product to assign to the branch.",
  })
  @IsUUID("4")
  productId!: string;

  @ApiProperty({
    minimum: 0,
    example: 50,
    description: "Units of the lot being added.",
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      "Minimum stock threshold for the product in the branch. Ignored when the product already has lots in the branch, which keep their current minimum.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumStock: number = 0;

  @ApiProperty({
    example: "2027-06-30",
    format: "date",
    description:
      "Expiration date of the lot (YYYY-MM-DD). Must not be in the past.",
  })
  @IsDateString(
    { strict: true },
    { message: "expirationDate must be a valid ISO 8601 date (YYYY-MM-DD)" },
  )
  expirationDate!: string;

  @ApiPropertyOptional({
    description: "Free-text note recorded with the assignment.",
  })
  @IsOptional()
  @IsString()
  observation?: string;
}

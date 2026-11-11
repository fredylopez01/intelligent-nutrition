import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateBranchDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description:
      "Branch name. It must be unique. At least one field must be sent.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ maxLength: 255, description: "Branch address." })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    maxLength: 30,
    pattern: "^\\d+$",
    example: "6017000000",
    description: "Branch phone number (digits only).",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^\d+$/)
  phone?: string;
}

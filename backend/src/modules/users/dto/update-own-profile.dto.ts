import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateOwnProfileDto {
  @ApiPropertyOptional({ maxLength: 100, description: "First name." })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ maxLength: 100, description: "Last name." })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ maxLength: 200, description: "Business name." })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  businessName?: string;

  @ApiPropertyOptional({
    maxLength: 30,
    pattern: "^\\d+$",
    example: "3001234567",
    description: "Contact phone number (digits only).",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^\d+$/)
  phone?: string;

  @ApiPropertyOptional({ maxLength: 255, description: "Postal address." })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    description:
      "Public URL of a photo uploaded through the photo-upload-url endpoint.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(500)
  profilePhotoUrl?: string;
}

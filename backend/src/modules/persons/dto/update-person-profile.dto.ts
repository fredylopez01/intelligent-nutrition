import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdatePersonProfileDto {
  @ApiPropertyOptional({
    format: "uuid",
    description: "Identification document type.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  documentTypeId?: string;

  @ApiPropertyOptional({
    maxLength: 50,
    description: "Identification document number.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentNumber?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    minLength: 1,
    maxLength: 100,
    description: "First name.",
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    minLength: 1,
    maxLength: 100,
    description: "Last name.",
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    minLength: 1,
    maxLength: 200,
    description: "Business name.",
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  businessName?: string | null;

  @ApiPropertyOptional({
    maxLength: 150,
    format: "email",
    description: "Email address. It is stored in lowercase and must be unique.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(150)
  email?: string;

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
    description: "URL of the profile photo.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(500)
  profilePhotoUrl?: string;
}

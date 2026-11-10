import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class CreatePersonDto {
  @ApiProperty({ format: "uuid", description: "Identification document type." })
  @IsUUID()
  documentTypeId!: string;

  @ApiProperty({
    maxLength: 50,
    example: "1052345678",
    description: "Identification document number.",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentNumber!: string;

  @ApiPropertyOptional({
    maxLength: 100,
    example: "Laura",
    description: "First name. Must be sent together with lastName.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    example: "Pérez",
    description: "Last name. Must be sent together with firstName.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    example: "Distribuciones Vitales S.A.S.",
    description:
      "Business name, for legal entities. Required when firstName and lastName are not sent.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  businessName?: string;

  @ApiProperty({
    maxLength: 150,
    format: "email",
    example: "contacto@example.com",
    description: "Email address. It is stored in lowercase and must be unique.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({
    maxLength: 30,
    example: "3001234567",
    description: "Contact phone number.",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  @ApiProperty({
    maxLength: 255,
    example: "Calle 10 # 20-30, Tunja",
    description: "Postal address.",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;
}

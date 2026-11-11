import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdateUnitMeasureDto {
  @ApiPropertyOptional({
    minLength: 3,
    maxLength: 50,
    description:
      "Unit of measure name. It must be unique. At least one field must be sent.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    maxLength: 10,
    description: "Abbreviation of the unit. It must be unique.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  abreviation?: string;
}

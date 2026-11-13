import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdateSupplyDto {
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 150,
    description: "Unique supply name.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Active unit of measure.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  unitOfMeasureId?: string;
}

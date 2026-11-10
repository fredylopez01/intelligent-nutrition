import {
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdateSupplyDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  unitOfMeasureId?: string;
}

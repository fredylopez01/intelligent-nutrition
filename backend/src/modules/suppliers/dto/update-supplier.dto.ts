import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { UpdatePersonProfileDto } from "../../persons/dto/update-person-profile.dto.js";

export class UpdateSupplierDto {
  @ApiPropertyOptional({
    type: UpdatePersonProfileDto,
    description: "Fields of the supplier's person profile to update.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePersonProfileDto)
  person?: UpdatePersonProfileDto;

  @ApiPropertyOptional({
    maxLength: 200,
    description:
      "Commercial (trade) name of the supplier. At least one field must be sent.",
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  commercialName?: string;
}

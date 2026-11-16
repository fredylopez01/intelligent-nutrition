import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { CreatePersonDto } from "../../persons/dto/create-person.dto.js";

export class CreateSupplierDto {
  @ApiPropertyOptional({
    type: CreatePersonDto,
    description:
      "Data of the person to register as a supplier. Send either person or personId, not both.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePersonDto)
  person?: CreatePersonDto;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Id of an existing active person to register as a supplier. Send either person or personId, not both.",
  })
  @IsOptional()
  @IsUUID()
  personId?: string;

  @ApiProperty({
    maxLength: 200,
    example: "Distribuciones Vitales",
    description: "Commercial (trade) name of the supplier.",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  commercialName!: string;
}

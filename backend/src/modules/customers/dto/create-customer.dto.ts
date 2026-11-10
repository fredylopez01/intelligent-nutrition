import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsUUID, ValidateNested } from "class-validator";
import { CreatePersonDto } from "../../persons/dto/create-person.dto.js";

export class CreateCustomerDto {
  @ApiPropertyOptional({
    type: CreatePersonDto,
    description:
      "Data of the person to register as a customer. Send either person or personId, not both.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePersonDto)
  person?: CreatePersonDto;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Id of an existing active person to register as a customer. Send either person or personId, not both.",
  })
  @IsOptional()
  @IsUUID()
  personId?: string;
}

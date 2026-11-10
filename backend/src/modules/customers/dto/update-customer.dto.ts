import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, ValidateNested } from "class-validator";
import { UpdatePersonProfileDto } from "../../persons/dto/update-person-profile.dto.js";

export class UpdateCustomerDto {
  @ApiPropertyOptional({
    type: UpdatePersonProfileDto,
    description: "Fields of the customer's person profile to update.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePersonProfileDto)
  person?: UpdatePersonProfileDto;
}

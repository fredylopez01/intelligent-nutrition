import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, ValidateNested } from "class-validator";
import { UpdatePersonProfileDto } from "../../persons/dto/update-person-profile.dto.js";

export class UpdateUserDto {
  @ApiPropertyOptional({
    type: UpdatePersonProfileDto,
    description:
      "Fields of the user's person profile to update. At least one field must be sent.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePersonProfileDto)
  person?: UpdatePersonProfileDto;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { CreatePersonDto } from "../../persons/dto/create-person.dto.js";

export class CreateUserDto {
  @ApiPropertyOptional({
    type: CreatePersonDto,
    description:
      "Data of the new person that owns the account. Send either person or personId, not both.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePersonDto)
  person?: CreatePersonDto;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Id of an existing person without a user account. Send either person or personId, not both.",
  })
  @IsOptional()
  @IsUUID()
  personId?: string;

  @ApiProperty({
    format: "uuid",
    description: "Active role assigned to the account.",
  })
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({
    type: "array",
    items: { type: "string", format: "uuid" },
    uniqueItems: true,
    description:
      "Active branches assigned to the user. Duplicates are not allowed.",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  branchIds?: string[];
}

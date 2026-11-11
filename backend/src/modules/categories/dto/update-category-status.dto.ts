import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateCategoryStatusDto {
  @ApiProperty({
    example: false,
    description:
      "New status: true activates the category, false deactivates it.",
  })
  @IsBoolean()
  active!: boolean;
}

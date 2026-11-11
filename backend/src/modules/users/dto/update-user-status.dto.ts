import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateUserStatusDto {
  @ApiProperty({
    example: false,
    description:
      "New status: true activates the account, false deactivates it.",
  })
  @IsBoolean()
  active!: boolean;
}

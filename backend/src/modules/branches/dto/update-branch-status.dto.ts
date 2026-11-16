import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateBranchStatusDto {
  @ApiProperty({
    example: false,
    description: "New status: true activates the branch, false deactivates it.",
  })
  @IsBoolean()
  active!: boolean;
}

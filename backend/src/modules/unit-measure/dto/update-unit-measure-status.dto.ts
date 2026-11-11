import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateUnitMeasureStatusDto {
  @ApiProperty({
    example: false,
    description: "New status: true activates the unit, false deactivates it.",
  })
  @IsBoolean()
  active!: boolean;
}

import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdatePromotionStatusDto {
  @ApiProperty({
    example: true,
    description:
      "true activates the promotion and deactivates the previous active one.",
  })
  @IsBoolean()
  active!: boolean;
}

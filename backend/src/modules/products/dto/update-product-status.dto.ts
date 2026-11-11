import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateProductStatusDto {
  @ApiProperty({
    example: false,
    description:
      "New status: true activates the product, false deactivates it.",
  })
  @IsBoolean()
  active!: boolean;
}

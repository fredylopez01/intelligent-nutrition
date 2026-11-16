import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateCustomerStatusDto {
  @ApiProperty({
    example: false,
    description:
      "New status: true activates the customer, false deactivates it.",
  })
  @IsBoolean()
  active!: boolean;
}

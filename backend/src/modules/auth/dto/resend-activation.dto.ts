import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class ResendActivationDto {
  @ApiProperty({
    format: "email",
    example: "laura.perez@example.com",
    description: "Email of the account that has not been activated yet.",
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

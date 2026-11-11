import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({
    format: "email",
    example: "laura.perez@example.com",
    description: "Email of the account whose password must be reset.",
  })
  @IsEmail()
  email!: string;
}

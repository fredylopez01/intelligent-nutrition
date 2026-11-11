import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
  @ApiProperty({
    format: "email",
    example: "laura.perez@example.com",
    description: "Email of the user account.",
  })
  @IsEmail()
  email!: string;

  @ApiProperty({ format: "password", description: "Account password." })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ format: "password", description: "Current password." })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    format: "password",
    minLength: 8,
    maxLength: 128,
    description:
      "New password. It must differ from the current one and contain a lowercase letter, an uppercase letter, a number and a special character.",
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/[a-z]/, { message: "Password must contain a lowercase letter" })
  @Matches(/[A-Z]/, { message: "Password must contain an uppercase letter" })
  @Matches(/[0-9]/, { message: "Password must contain a number" })
  @Matches(/[^A-Za-z0-9]/, {
    message: "Password must contain a special character",
  })
  newPassword!: string;
}

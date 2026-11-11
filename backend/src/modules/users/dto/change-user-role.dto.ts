import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class ChangeUserRoleDto {
  @ApiProperty({
    format: "uuid",
    description: "Active role to assign to the user.",
  })
  @IsUUID()
  @IsNotEmpty()
  roleId!: string;
}

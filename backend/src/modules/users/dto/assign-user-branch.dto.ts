import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AssignUserBranchDto {
  @ApiProperty({
    format: "uuid",
    description: "Active branch to assign to the user.",
  })
  @IsUUID()
  branchId!: string;
}

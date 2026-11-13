import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class ActiveCashShiftQueryDto {
  @ApiProperty({
    format: "uuid",
    description: "Branch whose open shift is requested.",
  })
  @IsUUID()
  branchId!: string;
}

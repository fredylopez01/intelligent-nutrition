import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class RestockReportQueryDto {
  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Branch of the report. Without it the superadmin sees every branch; the branch leader sees its branches.",
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

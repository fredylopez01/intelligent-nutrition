import { IsOptional, IsUUID } from "class-validator";

export class RestockReportQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

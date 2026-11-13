import { IsUUID } from "class-validator";

export class ActiveCashShiftQueryDto {
  @IsUUID()
  branchId!: string;
}

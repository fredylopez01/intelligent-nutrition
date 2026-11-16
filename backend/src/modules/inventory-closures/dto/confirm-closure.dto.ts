import { IsOptional, IsUUID } from "class-validator";

export class ConfirmClosureDto {
  @IsOptional()
  @IsUUID()
  cashShiftId?: string;
}

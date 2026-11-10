import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from "class-validator";

export class OpenCashShiftDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: "openingAmount must be a decimal string with 2 decimal places (e.g. \"50000.00\")",
  })
  openingAmount!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observation?: string;
}

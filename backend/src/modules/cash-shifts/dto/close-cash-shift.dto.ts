import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class CloseCashShiftDto {
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: "closingAmount must be a decimal string with 2 decimal places (e.g. \"380000.00\")",
  })
  closingAmount!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observation?: string;
}

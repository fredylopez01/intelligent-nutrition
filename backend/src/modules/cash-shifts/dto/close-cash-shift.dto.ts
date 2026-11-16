import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class CloseCashShiftDto {
  @ApiProperty({
    pattern: "^\\d+\\.\\d{2}$",
    example: "380000.00",
    description: "Closing cash with two decimals.",
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: "closingAmount must be a decimal string with 2 decimal places (e.g. \"380000.00\")",
  })
  closingAmount!: string;

  @ApiPropertyOptional({
    example: "Cierre sin novedades",
    description: "Optional observation.",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observation?: string;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from "class-validator";

export class OpenCashShiftDto {
  @ApiProperty({ format: "uuid", description: "Branch of the shift." })
  @IsUUID()
  branchId!: string;

  @ApiProperty({
    pattern: "^\\d+\\.\\d{2}$",
    example: "50000.00",
    description: "Opening cash with two decimals.",
  })
  @IsString()
  @Matches(/^\d+\.\d{2}$/, {
    message: "openingAmount must be a decimal string with 2 decimal places (e.g. \"50000.00\")",
  })
  openingAmount!: string;

  @ApiPropertyOptional({
    example: "Apertura turno mañana",
    description: "Optional observation.",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observation?: string;
}

import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from "class-validator";
import { CashShiftStatus } from "../../../../generated/prisma/enums.js";

export class ListCashShiftsQueryDto {
  @ApiPropertyOptional({
    format: "uuid",
    description: "Branch of the shifts. Required for the branch leader.",
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    enum: ["OPEN", "CLOSED"],
    description: "Filter by state.",
  })
  @IsOptional()
  @IsEnum(CashShiftStatus)
  status?: CashShiftStatus;

  @ApiPropertyOptional({
    format: "date",
    description: "First day of openedAt.",
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ format: "date", description: "Last day of openedAt." })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "User who opened the shift.",
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: "Page number." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 20,
    description: "Page size.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

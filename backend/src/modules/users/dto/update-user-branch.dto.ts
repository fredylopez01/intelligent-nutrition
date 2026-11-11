import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsOptional } from "class-validator";

export class UpdateUserBranchDto {
  @ApiProperty({
    example: false,
    description:
      "Only false is supported: the endpoint deactivates the assignment.",
  })
  @IsBoolean()
  active!: boolean;

  @ApiPropertyOptional({
    example: "2026-11-30",
    description:
      "Accepted but currently ignored: the end date is set to the current date.",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

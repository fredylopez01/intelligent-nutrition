import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class AvailabilityQueryDto {
  @ApiProperty({
    format: "uuid",
    description: "Product whose availability is queried.",
  })
  @IsUUID("4")
  productId!: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Branch to leave out of the result.",
  })
  @IsOptional()
  @IsUUID("4")
  excludeBranchId?: string;
}

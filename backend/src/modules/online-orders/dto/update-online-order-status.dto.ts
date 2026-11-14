import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

export const MANUAL_STATUSES = [
  "CONFIRMED",
  "READY",
  "OUT_FOR_DELIVERY",
  "CANCELLED",
] as const;

export type ManualStatus = (typeof MANUAL_STATUSES)[number];

export class UpdateOnlineOrderStatusDto {
  @ApiProperty({
    enum: MANUAL_STATUSES,
    description:
      "CONFIRMED (payment or pickup agreed), READY (pickup), OUT_FOR_DELIVERY (delivery) or CANCELLED. DELIVERED is set by completing the order.",
  })
  @IsIn(MANUAL_STATUSES)
  status!: ManualStatus;

  @ApiPropertyOptional({
    maxLength: 500,
    description: "Required when the order is cancelled.",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @ValidateIf((dto: UpdateOnlineOrderStatusDto) => dto.status === "CANCELLED")
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}

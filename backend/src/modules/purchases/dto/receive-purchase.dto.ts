import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class ReceivePurchaseItemDto {
  @ApiProperty({
    format: "uuid",
    description: "Purchase line (detail) being received.",
  })
  @IsUUID("4")
  purchaseDetailId!: string;

  @ApiProperty({
    minimum: 0,
    example: 10,
    description:
      "Units received in this lot. Cannot exceed the units still pending on the line.",
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  receivedQuantity!: number;

  @ApiProperty({
    example: "2027-06-30",
    format: "date",
    description:
      "Expiration date of the lot (YYYY-MM-DD). Must not be in the past.",
  })
  @IsDateString(
    { strict: true },
    { message: "expirationDate must be a valid ISO 8601 date (YYYY-MM-DD)" },
  )
  expirationDate!: string;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Optional destination branch for the lot. It must exist and be active.",
  })
  @IsOptional()
  @IsUUID("4")
  branchId?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    description: "Free-text note about this lot.",
  })
  @IsOptional()
  @Transform(({ value }): unknown =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  observation?: string;
}

export class ReceivePurchaseDto {
  @ApiProperty({
    type: [ReceivePurchaseItemDto],
    minItems: 1,
    description:
      "Lots received. A line can be split into several lots, but the same line, expiration date and branch cannot repeat.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseItemDto)
  items!: ReceivePurchaseItemDto[];
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CompleteOnlineOrderDto {
  @ApiProperty({
    format: "uuid",
    description: "Payment method used to pay the whole order.",
  })
  @IsUUID("4")
  paymentMethodId!: string;

  @ApiPropertyOptional({ maxLength: 100, description: "Transfer reference." })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

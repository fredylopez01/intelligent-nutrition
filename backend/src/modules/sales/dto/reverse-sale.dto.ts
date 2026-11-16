import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ReverseSaleDto {
  @ApiProperty({
    minLength: 10,
    example: "Customer returned the products the same day.",
    description: "Reason for reversing the sale (at least 10 characters).",
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(10, {
    message: "reason must contain at least 10 characters.",
  })
  reason!: string;
}
